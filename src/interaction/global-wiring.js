/**
 * Global event wiring — scroll, mousedown, dblclick, click, keyboard, clipboard,
 * popover dismissal, and beforeunload cleanup.
 */
export const globalWiringMethods = {
  _wireGlobal() {
    const wrap = this.shadowRoot.querySelector("[data-gridwrap]");
    if (!wrap) return;

    wrap.addEventListener("scroll", () => {
      if (!this.config.virtualization) return;
      const st = wrap.scrollTop;
      if (Math.abs(st - this._virt.lastScrollTop) < 4) return;
      this._virt.lastScrollTop = st;

      // Skip full DOM rebuild when editing and editing row stays within the new virt range.
      // This prevents the scroll handler from destroying the active editor.
      if (this.state.editing) {
        const { start, end } = this._calcVirtRange();
        if (this.state.editing.r >= start && this.state.editing.r <= end) {
          this._updateSelectionClasses();
          this._attachFillHandle();
          return;
        }
      }

      this._renderBody();
      this._updateSelectionClasses();
      this._attachFillHandle();
    }, { passive: true });

    wrap.addEventListener("mousedown", (e) => this._onMouseDown(e));
    wrap.addEventListener("mousemove", (e) => this._onMouseMove(e));
    wrap.addEventListener("mouseup", () => this._onMouseUp());
    wrap.addEventListener("mouseleave", () => this._onMouseUp());

    wrap.addEventListener("dblclick", (e) => {
      const td = e.target.closest("td");
      if (!td) return;
      const r = Number(td.dataset.r);
      const c = Number(td.dataset.c);
      // If already editing this cell, let the dblclick act naturally (select word, etc.)
      if (this.state.editing && this.state.editing.r === r && this.state.editing.c === c) return;
      this._startEdit(r, c);
    });

    wrap.addEventListener("click", (e) => {
      if (this.state.editing) return;
      if (this._mouse.didDragSelection) return;

      const td = e.target.closest("td");
      if (!td) return;

      const r = Number(td.dataset.r);
      const c = Number(td.dataset.c);

      const rowId = td.dataset.rowid;
      const colId = td.dataset.colid;
      const key = `${rowId}|${colId}`;
      if (this._conflicts.has(key)) {
        this._openConflictModal(rowId, colId);
        return;
      }

      const col = this._colById(colId);
      if (!col || !this._canEditCol(col)) return;

      if (col.type === "choice" || col.type === "datetime" || col.type === "person") {
        this._startEdit(r, c);
      }
    });

    wrap.addEventListener("keydown", (e) => this._onKeyDown(e));
    wrap.addEventListener("copy", (e) => this._onCopy(e));
    wrap.addEventListener("cut", (e) => this._onCut(e));
    wrap.addEventListener("paste", (e) => this._onPaste(e));

    window.addEventListener("mousedown", (e) => {
      const path = e.composedPath?.() || [];

      const ctx = this.shadowRoot.querySelector("[data-ctxmenu]");
      const pop = this.shadowRoot.querySelector("[data-filterpop]");
      const colsPop = this.shadowRoot.querySelector("[data-colspop]");
      const colsBtn = this.shadowRoot.querySelector("[data-cols]");

      if (ctx && !path.includes(ctx)) this._closeCtxMenu();
      if (pop && !path.includes(pop)) this._closeFilter();
      if (colsPop && !path.includes(colsPop) && !(colsBtn && path.includes(colsBtn))) this._closeColumnsPopover();

      if (this.state.editing) {
        // Use composedPath to look through shadow DOM boundary.
        // e.target is retargeted to <sheet-grid> at window level, so
        // e.target.closest("td") never works for shadow internals.
        const editor = this.shadowRoot.querySelector("[data-inline-editor]");
        if (editor && editor.tagName === "SELECT") return;

        // Check if any element in the composed path is the editor or its parent td
        const clickedEditor = editor && path.includes(editor);
        if (clickedEditor) return; // Click inside editor — let caret move naturally

        // Check if the click landed on the same cell (but not the editor itself)
        const ed = this.state.editing;
        const clickedSameCell = path.some(el =>
          el?.dataset?.r !== undefined &&
          el?.dataset?.c !== undefined &&
          Number(el.dataset.r) === ed.r &&
          Number(el.dataset.c) === ed.c
        );
        if (clickedSameCell) return; // Same cell — don't commit

        const insideComponent = path.includes(this);
        this._commitEdit({ reason: insideComponent ? "click-other" : "outside" });
      }
    }, { capture: true });

    // Release lock + flush pending saves on hard unload
    window.addEventListener("beforeunload", () => {
      try {
        // Flush any unsaved cell values via sendBeacon (fire-and-forget)
        if (this._pending.size > 0) {
          const updates = [];
          for (const [, u] of this._pending.entries()) {
            updates.push({ rowId: u.rowId, colId: u.colId, value: u.value, baseRowVer: this._rowVer.get(u.rowId) || null });
          }
          navigator.sendBeacon?.(
            `${this.apiBase}/api/auditorRequests/batch`,
            new Blob([JSON.stringify({ clientId: this.clientId, byUser: this.userId, updates })], { type: "application/json" })
          );
        }

        if (this._ownedLock) {
          const { rowId, colId } = this._ownedLock;
          navigator.sendBeacon?.(`${this.apiBase}/api/locks/release`, JSON.stringify({ clientId: this.clientId, rowId, colId, userId: this.userId }));
          navigator.sendBeacon?.(`${this.apiBase}/api/typing`, JSON.stringify({ clientId: this.clientId, rowId, colId, userId: this.userId, value: "" }));
        }
      } catch {}
    });
  },
};
