/**
 * Fill handle — drag-to-fill cell values (Excel-style autofill).
 */
import { clamp } from '../utils/helpers.js';

export const fillHandleMethods = {
  _startFillDrag() {
    const sel = this._normalizeSel(this.state.selection);
    this._fill = {
      sourceSel: sel,
      startCell: { r: this.state.active.r, c: this.state.active.c },
      endCell: { r: this.state.active.r, c: this.state.active.c },
    };
  },

  _updateFillPreview() {
    this.shadowRoot.querySelectorAll("td.fillPreview").forEach(el => el.classList.remove("fillPreview"));

    const f = this._fill;
    if (!f) return;

    const s = f.sourceSel;
    const e = f.endCell;

    const r1 = Math.min(s.r1, e.r);
    const r2 = Math.max(s.r2, e.r);
    const c1 = Math.min(s.c1, e.c);
    const c2 = Math.max(s.c2, e.c);

    const start = this._virt.start ?? 0;
    const end = this._virt.end ?? (this._view.viewRowIds.length - 1);

    const rr1 = clamp(r1, start, end);
    const rr2 = clamp(r2, start, end);

    for (let rr = rr1; rr <= rr2; rr++) {
      for (let cc = c1; cc <= c2; cc++) {
        const inSource = (rr >= s.r1 && rr <= s.r2 && cc >= s.c1 && cc <= s.c2);
        if (inSource) continue;
        const td = this._getCellTd(rr, cc);
        if (td) td.classList.add("fillPreview");
      }
    }
  },

  _finishFillDrag() {
    const f = this._fill;
    this._fill = null;
    this.shadowRoot.querySelectorAll("td.fillPreview").forEach(el => el.classList.remove("fillPreview"));
    if (!f) return;

    const s = f.sourceSel;
    const e = f.endCell;

    const r1 = Math.min(s.r1, e.r);
    const r2 = Math.max(s.r2, e.r);
    const c1 = Math.min(s.c1, e.c);
    const c2 = Math.max(s.c2, e.c);

    const source = this._getSelectionMatrix(s);
    const srcRows = source.length;
    const srcCols = source[0]?.length ?? 1;

    const changes = [];

    for (let rr = r1; rr <= r2; rr++) {
      for (let cc = c1; cc <= c2; cc++) {
        if (rr >= s.r1 && rr <= s.r2 && cc >= s.c1 && cc <= s.c2) continue;

        const srcR = (rr - s.r1) % srcRows;
        const srcC = (cc - s.c1) % srcCols;
        const val = source[srcR]?.[srcC] ?? "";

        const ch = this._setCellByView(rr, cc, val);
        if (ch) changes.push(ch);
      }
    }

    if (changes.length) {
      for (const ch of changes) this._saveCellToServer(ch.rowId, ch.colId, ch.value);
      this._recomputeView();
      this._computeRowMeta();
      this._renderGrid({ full: false });
      this._setStatus("Filled");
    }
  },
};
