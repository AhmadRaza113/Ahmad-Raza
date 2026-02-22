/**
 * Inline editor wiring — start edit, commit, cancel, editor keyboard/input events.
 */
import { isBlank, clamp } from '../utils/helpers.js';
import { normalizeDatetimeLocalValue } from '../utils/datetime.js';
import { formatValue } from '../utils/format.js';

export const inlineEditorMethods = {
  _wireInlineEditorIfAny() {
    if (!this.state.editing) return;
    const el = this.shadowRoot.querySelector("[data-inline-editor]");
    if (!el) return;

    const ed = this.state.editing;

    queueMicrotask(() => {
      try {
        el.focus();

        if (ed._liveValue != null && ed._cursorPos != null) {
          // Restoring after a re-render — keep typed value and cursor
          if (el.setSelectionRange) el.setSelectionRange(ed._cursorPos, ed._cursorPos);
          delete ed._liveValue;
          delete ed._cursorPos;
        } else if (ed.firstKey && typeof el.value === "string" && el.tagName !== "SELECT") {
          el.value = ed.firstKey;
          if (el.setSelectionRange) el.setSelectionRange(el.value.length, el.value.length);
        } else if (el.select && el.tagName !== "SELECT") {
          el.select();
        }
      } catch {}
    });

    el.addEventListener("mousedown", (e) => e.stopPropagation());

    if (el.tagName === "SELECT") {
      el.addEventListener("change", () => { if (this.state.editing) this._commitEdit({ reason: "change" }); });
      el.addEventListener("blur", () => { if (this.state.editing) this._commitEdit({ reason: "blur" }); }, { once: true });

      el.addEventListener("keydown", (e) => {
        if (e.key === "Escape") { this._cancelEdit(); e.preventDefault(); return; }
        if (e.key === "Tab") {
          const dc = e.shiftKey ? -1 : 1;
          this._commitEdit({ reason: "tab", move: { dr: 0, dc } });
          e.preventDefault();
          return;
        }
        if (e.key === "Enter") {
          this._commitEdit({ reason: "enter", move: { dr: 1, dc: 0 } });
          e.preventDefault();
          return;
        }
      });
      return;
    }

    el.addEventListener("keydown", (e) => {
      const col = this._colById(this.state.editing?.colId);

      if (col?.type === "multiline") {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          this._commitEdit({ reason: "ctrl-enter", move: { dr: 1, dc: 0 } });
          e.preventDefault();
          return;
        }
        if (e.key === "Escape") { this._cancelEdit(); e.preventDefault(); return; }
        if (e.key === "Tab") {
          const dc = e.shiftKey ? -1 : 1;
          this._commitEdit({ reason: "tab", move: { dr: 0, dc } });
          e.preventDefault();
          return;
        }
        return;
      }

      if (e.key === "Enter") {
        const dr = e.shiftKey ? -1 : 1;
        this._commitEdit({ reason: "enter", move: { dr, dc: 0 } });
        e.preventDefault();
        return;
      }
      if (e.key === "Escape") { this._cancelEdit(); e.preventDefault(); return; }
      if (e.key === "Tab") {
        const dc = e.shiftKey ? -1 : 1;
        this._commitEdit({ reason: "tab", move: { dr: 0, dc } });
        e.preventDefault();
        return;
      }
    });

    // Live typing broadcast — send typed value to other users in real time
    el.addEventListener("input", () => {
      if (!this.state.editing) return;
      const { rowId, colId } = this.state.editing;
      const currentValue = el.value ?? "";
      this._lastBroadcastKey = `${rowId}|${colId}`;
      this._broadcastTypingDebounced(rowId, colId, currentValue);
    });

    el.addEventListener("blur", () => {
      // If the editor was removed from DOM by a re-render (not a real user blur), skip commit.
      // _renderBody() will re-create the editor because this.state.editing is still set.
      if (!this.shadowRoot.contains(el)) return;
      if (this.state.editing) this._commitEdit({ reason: "blur" });
    }, { once: true });
  },

  /** Format a cell value for display based on column type (uses imported formatValue) */
  _formatValue(col, value) {
    return formatValue(col, value);
  },

  async _startEdit(viewR, viewC, { firstKey = null } = {}) {
    if (this.readOnly) return;
    // Prevent re-entrant calls (fast typing fires multiple _startEdit while lock is in-flight)
    if (this._startEditInFlight) return;
    // If already editing this exact cell, ignore
    if (this.state.editing && this.state.editing.r === viewR && this.state.editing.c === viewC) return;

    const colId = this._view.viewColIds[viewC];
    const rowId = this._view.viewRowIds[viewR];
    const col = this._colById(colId);
    if (!col || col.readOnly) return;

    const key = `${rowId}|${colId}`;

    if (this._conflicts.has(key)) {
      this._openConflictModal(rowId, colId);
      return;
    }

    const lock = this._locks.get(key);
    if (lock?.userId && lock.userId !== this.userId) {
      this._toast(`Locked by ${lock.userId}.`, { kind: "warn" });
      return;
    }

    // Set editing state IMMEDIATELY so keyboard handler stops dispatching
    // new _startEdit calls while the lock request is in-flight.
    this.state.editing = { r: viewR, c: viewC, colId, rowId, firstKey };
    this._startEditInFlight = true;

    // Render editor optimistically so the user sees it immediately (lockPending style shows
    // a pulsing outline while the lock request is in-flight).
    this._renderBody();
    this._updateSelectionClasses();
    this._attachFillHandle();

    // Acquire lock in background — editor is already visible above
    try {
      const res = await this._acquireLock(rowId, colId);
      if (!res.acquired) {
        if (res.holder?.userId === this.userId) {
          this._locks.set(key, { ...res.holder, owned: true });
          await this._startLockRenew(rowId, colId);
        } else {
          // Lock denied — roll back the optimistic editor
          this.state.editing = null;
          const holder = res.holder?.userId ? res.holder.userId : "another user";
          this._toast(`Cell is locked by ${holder}.`, { kind: "warn" });
          this._renderBody();
          this._updateSelectionClasses();
          return;
        }
      }
    } catch (e) {
      this.state.editing = null;
      this._toast("Unable to lock cell (network).", { kind: "error", detail: String(e?.message || e) });
      this._renderBody();
      return;
    } finally {
      this._startEditInFlight = false;
      // Remove the pending-lock visual once lock is resolved (no re-render needed)
      this.shadowRoot.querySelector(".lockPending")?.classList.remove("lockPending");
    }
    // Editor is already showing — no second _renderBody() needed
  },

  async _commitEdit({ reason = "commit", move = null, selectAfter = null } = {}) {
    const ed = this.state.editing;
    if (!ed) return;

    const input = this.shadowRoot.querySelector("[data-inline-editor]");
    const col = this._colById(ed.colId);
    const row = this.state.rows.find(r => r.id === ed.rowId);

    let changed = false;
    let newValue = null;

    if (col && row && input) {
      let raw = input.value ?? "";
      if (col.type === "datetime") raw = isBlank(raw) ? "" : normalizeDatetimeLocalValue(raw);
      else if (col.type === "number") raw = isBlank(raw) ? "" : (Number.isNaN(Number(raw)) ? String(raw) : Number(raw));
      else raw = String(raw ?? "");

      const oldValue = row.values?.[ed.colId] ?? "";
      if (oldValue !== raw) {
        row.values[ed.colId] = raw;
        changed = true;
        newValue = raw;
      }
    }

    const lastR = ed.r, lastC = ed.c;
    const rowId = ed.rowId, colId = ed.colId;

    this.state.editing = null;
    this._renderBody();

    // CRITICAL: cancel any pending debounced typing broadcast for this cell.
    // Without this, a stale intermediate keystroke value (e.g. "hell" when user
    // saved "hello") can arrive at other clients AFTER the gridPatch, temporarily
    // overwriting the correct saved value with an older typed preview.
    this._broadcastTypingDebounced.cancel();
    this._lastBroadcastKey = null;

    // Save to server — this broadcasts gridPatch to all other users so they
    // get the authoritative committed value.
    if (changed) {
      await this._flushNow(rowId, colId, newValue);
    }

    // Small delay so the gridPatch has time to reach other clients and be applied
    // before the typing-clear message removes their remoteTyping preview. If the
    // clear arrives first, other clients briefly see the old row value until the
    // patch arrives — which is acceptable but jarring. 200ms cover most RTTs.
    await new Promise(r => setTimeout(r, 200));

    // Now clear typing indicator and release lock.
    this._broadcastTyping(rowId, colId, "").catch(() => {});
    this._clearRemoteTyping(rowId, colId);

    await this._releaseOwnedLock().catch(() => {});

    this._recomputeView();
    this._computeRowMeta();

    if (selectAfter) {
      const { r, c, shift } = selectAfter;
      if (!shift) {
        this.state.active = { r, c };
        this.state.selection = { r1: r, c1: c, r2: r, c2: c };
      } else {
        const a = this.state.selection;
        this.state.active = { r, c };
        this.state.selection = { r1: a.r1, c1: a.c1, r2: r, c2: c };
      }
    } else if (move) {
      const maxR = Math.max(0, this._view.viewRowIds.length - 1);
      const maxC = Math.max(0, this._view.viewColIds.length - 1);
      const nr = clamp(lastR + (move.dr || 0), 0, maxR);
      const nc = clamp(lastC + (move.dc || 0), 0, maxC);
      this.state.active = { r: nr, c: nc };
      this.state.selection = { r1: nr, c1: nc, r2: nr, c2: nc };
    }

    this._renderGrid({ full: false });
    this._ensureCellVisible(this.state.active.r, this.state.active.c);
    this.shadowRoot.querySelector("[data-gridwrap]")?.focus();
  },

  _cancelEdit() {
    if (!this.state.editing) return;
    const { rowId, colId } = this.state.editing;
    this.state.editing = null;

    // Cancel any in-flight debounced typing so stale values don't fly out after cancel.
    this._broadcastTypingDebounced.cancel();
    this._lastBroadcastKey = null;

    this._broadcastTyping(rowId, colId, "").catch(() => {});
    this._clearRemoteTyping(rowId, colId);

    this._releaseOwnedLock().catch(() => {});
    this._renderGrid({ full: false });
    this.shadowRoot.querySelector("[data-gridwrap]")?.focus();
  },
};
