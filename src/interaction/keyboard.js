/**
 * Keyboard interaction — arrow keys, Tab, Enter, Delete, character start-edit.
 */
import { clamp } from '../utils/helpers.js';

export const keyboardMethods = {
  _onKeyDown(e) {
    // Allow typing into active editor — do NOT swallow keystrokes
    if (this.state.editing) return;
    // Also block if a _startEdit is in-flight (lock request pending)
    if (this._startEditInFlight) return;

    const maxR = this._view.viewRowIds.length - 1;
    const maxC = this._view.viewColIds.length - 1;

    let { r, c } = this.state.active;
    let nr = r, nc = c;

    const isArrow = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key);
    if (e.key === "ArrowUp") nr = clamp(r - 1, 0, maxR);
    if (e.key === "ArrowDown") nr = clamp(r + 1, 0, maxR);
    if (e.key === "ArrowLeft") nc = clamp(c - 1, 0, maxC);
    if (e.key === "ArrowRight") nc = clamp(c + 1, 0, maxC);

    if (e.key === "Tab") {
      nc = clamp(c + (e.shiftKey ? -1 : 1), 0, maxC);
      e.preventDefault();
    }

    if (!this.readOnly && (e.key === "Enter" || e.key === "F2")) {
      this._startEdit(r, c);
      e.preventDefault();
      return;
    }

    if (!this.readOnly && (e.key === "Delete" || e.key === "Backspace")) {
      this._clearSelection();
      this._recomputeView();
      this._computeRowMeta();
      this._renderGrid({ full: false });
      e.preventDefault();
      return;
    }

    const moved = (nr !== r) || (nc !== c);
    if (moved) {
      this.state.active = { r: nr, c: nc };
      if (e.shiftKey && isArrow) {
        const a = this.state.selection;
        this.state.selection = { r1: a.r1, c1: a.c1, r2: nr, c2: nc };
      } else {
        this.state.selection = { r1: nr, c1: nc, r2: nr, c2: nc };
      }
      // Only rebuild DOM when the destination row leaves the rendered virtual range
      if (!this.config.virtualization || nr < this._virt.start || nr > this._virt.end) {
        this._renderBody();
      }
      this._updateSelectionClasses();
      this._attachFillHandle();
      this._ensureCellVisible(nr, nc);
      if (isArrow) e.preventDefault();
    }

    if (!this.readOnly && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      this._startEdit(r, c, { firstKey: e.key });
      e.preventDefault();
    }
  },
};
