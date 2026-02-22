/**
 * Mouse interaction — cell selection drag, column/row resize, fill drag detection.
 */
import { clamp } from '../utils/helpers.js';

export const mouseMethods = {
  _onMouseDown(e) {
    if (e.button !== 0) return;
    if (e.target.closest?.("[data-inline-editor]")) return;

    const path = e.composedPath?.() || [];
    const ctx = this.shadowRoot.querySelector("[data-ctxmenu]");
    const pop = this.shadowRoot.querySelector("[data-filterpop]");
    const colsPop = this.shadowRoot.querySelector("[data-colspop]");
    if ((ctx && path.includes(ctx)) || (pop && path.includes(pop)) || (colsPop && path.includes(colsPop))) return;

    if (e.target?.classList?.contains("fillHandle")) {
      e.preventDefault();
      e.stopPropagation();
      this._startFillDrag();
      return;
    }

    const td = e.target.closest("td");
    if (!td) return;

    const r = Number(td.dataset.r);
    const c = Number(td.dataset.c);

    if (this.state.editing && this.state.editing.r === r && this.state.editing.c === c) return;

    if (this.state.editing && (this.state.editing.r !== r || this.state.editing.c !== c)) {
      this._commitEdit({ reason: "click-cell", selectAfter: { r, c, shift: e.shiftKey } });
      return;
    }

    this._mouse.didDragSelection = false;

    if (!e.shiftKey) {
      this.state.active = { r, c };
      this.state.selection = { r1: r, c1: c, r2: r, c2: c };
    } else {
      const a = this.state.selection;
      this.state.active = { r, c };
      this.state.selection = { r1: a.r1, c1: a.c1, r2: r, c2: c };
    }

    this._mouse.selecting = true;
    this._updateSelectionClasses();
    this._attachFillHandle();
    this.shadowRoot.querySelector("[data-gridwrap]")?.focus();
  },

  _onMouseMove(e) {
    if (this._mouse.resizingCol) {
      const m = this._mouse.resizingCol;
      const dx = e.clientX - m.startX;
      const attempted = m.startW + dx;

      m.willHide = attempted < this.config.hideDragThreshold;

      const w = clamp(attempted, this.config.minColWidth, this.config.maxColWidth);
      this.state.colWidths[m.colId] = w;
      if (w > this.config.minColWidth) this.state.colLastWidth[m.colId] = w;

      const colEl = this.shadowRoot.querySelector(`col[data-colid="${m.colId}"]`);
      if (colEl) colEl.style.width = `${w}px`;
      this._applyTableWidth();
      this._persistUiDebounced();
      return;
    }

    if (this._mouse.resizingRow) {
      const m = this._mouse.resizingRow;
      const dy = e.clientY - m.startY;
      const h = clamp(m.startH + dy, this.config.minRowHeight, this.config.maxRowHeight);
      this.state.rowHeights[m.rowId] = h;

      const tr = this.shadowRoot.querySelector(`tr[data-rowid="${m.rowId}"]`);
      if (tr) tr.style.height = `${h}px`;

      this._computeRowMeta();
      this._persistUiDebounced();
      return;
    }

    if (this._fill) {
      const td = e.target.closest("td");
      if (!td) return;
      this._fill.endCell = { r: Number(td.dataset.r), c: Number(td.dataset.c) };
      this._updateFillPreview();
      return;
    }

    if (this._mouse.selecting) {
      const td = e.target.closest("td");
      if (!td) return;
      const r = Number(td.dataset.r);
      const c = Number(td.dataset.c);
      const a = this.state.selection;
      this.state.active = { r, c };
      this.state.selection = { r1: a.r1, c1: a.c1, r2: r, c2: c };
      this._mouse.didDragSelection = true;
      this._updateSelectionClasses();
      this._attachFillHandle();
    }
  },

  _onMouseUp() {
    if (this._mouse.resizingCol) {
      const { colId, willHide } = this._mouse.resizingCol;
      this._mouse.resizingCol = null;
      if (willHide) this._hideColumn(colId);
      return;
    }
    if (this._mouse.resizingRow) {
      this._mouse.resizingRow = null;
      return;
    }
    if (this._mouse.selecting) {
      this._mouse.selecting = false;
    }
    if (this._fill) this._finishFillDrag();
  },
};
