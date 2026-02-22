/**
 * Grid layout rendering — header, colgroup, and table width.
 */
import { escapeHtml } from '../utils/dom.js';

export const gridMethods = {
  _renderGrid({ full = false, persist = true } = {}) {
    if (!this._mounted) return;

    const addBtn = this.shadowRoot.querySelector("[data-add-row]");
    const delBtn = this.shadowRoot.querySelector("[data-del-row]");
    if (addBtn) addBtn.disabled = this.readOnly;
    if (delBtn) delBtn.disabled = this.readOnly;

    const hiddenCount = Object.entries(this.state.colHidden).filter(([id, v]) => v).length;
    const colsBtn = this.shadowRoot.querySelector("[data-cols]");
    if (colsBtn) colsBtn.textContent = hiddenCount ? `Columns (Hidden: ${hiddenCount})` : `Columns`;

    if (full) this._renderHeaderAndCols();
    else this._applyTableWidth();

    this._renderBody();
    this._updateSelectionClasses();
    this._attachFillHandle();
    if (persist) this._persistUiDebounced();
  },

  _renderHeaderAndCols() {
    const table = this.shadowRoot.querySelector("[data-table]");
    const colgroup = this.shadowRoot.querySelector("[data-colgroup]");
    const thead = this.shadowRoot.querySelector("[data-thead]");
    if (!table || !colgroup || !thead) return;

    const colIds = this._view.viewColIds;
    const cols = colIds.map(id => this._colById(id));

    colgroup.innerHTML = `
      <col data-colid="__rowhead__" style="width:72px">
      ${cols.map(c => `<col data-colid="${c.id}" style="width:${this.state.colWidths[c.id] ?? 160}px">`).join("")}
    `;

    this._applyTableWidth();

    thead.innerHTML = `
      <tr>
        <th class="corner" data-corner><div class="thInner clickable">Req No</div></th>
        ${cols.map(c => this._renderHeaderCell(c)).join("")}
      </tr>
    `;

    thead.querySelector("[data-corner]")?.addEventListener("click", () => this._selectAll());

    thead.querySelectorAll("th[data-colid]").forEach((th) => {
      th.addEventListener("click", (e) => {
        if (e.button !== 0) return;
        const viewC = this._view.viewColIds.indexOf(th.dataset.colid);
        if (viewC >= 0) this._selectColumn(viewC, { shift: e.shiftKey });
        if (!this.readOnly) {
          if (e.shiftKey) this._toggleSort(th.dataset.colid);
        }
      });

      th.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        this._openHeaderCtxMenu(th.dataset.colid, th);
      });

      const rh = th.querySelector("[data-resize-col]");
      if (rh) {
        rh.addEventListener("mousedown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const colId = rh.dataset.resizeCol;
          this._mouse.resizingCol = {
            colId,
            startX: e.clientX,
            startW: this.state.colWidths[colId] ?? 160,
            willHide: false,
          };
        });

        rh.addEventListener("dblclick", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._autoFitSingleColumn(rh.dataset.resizeCol);
        });
      }

      const dh = th.querySelector("[data-col-drag]");
      if (dh) {
        dh.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          try { dh.setPointerCapture?.(e.pointerId); } catch {}
          this._startColDrag(th.dataset.colid, e);
        });
      }
    });
  },

  _renderHeaderCell(col) {
    const sortIdx = this.state.sorts.findIndex(s => s.colId === col.id);
    const sortDir = sortIdx >= 0 ? this.state.sorts[sortIdx].dir : null;

    const ro = col.readOnly ? `<span class="badge" title="Read-only">🔒</span>` : "";
    const flt = this._isFilterActive(col.id) ? `<span class="badge" title="Filtered">F</span>` : "";
    const sortMark = sortDir ? `<span class="badge" title="Sorted">${sortDir === "asc" ? "↑" : "↓"}</span>` : "";

    return `
      <th data-colid="${col.id}">
        <div class="thInner clickable" title="Click to select | Right click for menu | Shift+Click toggles sort">
          <span class="dragHandle" data-col-drag title="Drag to reorder">⋮⋮</span>
          <span class="thLabel">${escapeHtml(col.name)}${ro}${flt}${sortMark}</span>
          ${sortDir ? `<span class="sortBadge">${sortIdx + 1}${sortDir === "asc" ? "↑" : "↓"}</span>` : ""}
          <div class="resizeCol" data-resize-col="${col.id}" title="Resize (double click to auto-fit)"></div>
        </div>
      </th>
    `;
  },

  _applyTableWidth() {
    const table = this.shadowRoot.querySelector("[data-table]");
    if (!table) return;
    const colIds = this._view.viewColIds;
    const cols = colIds.map(id => this._colById(id));
    const totalW = 72 + cols.reduce((sum, c) => sum + (this.state.colWidths[c.id] ?? 160), 0);
    table.style.width = `${totalW}px`;
  },
};
