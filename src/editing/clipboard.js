/**
 * Clipboard operations — copy, cut, paste, clear selection, cell-by-view setter.
 */
import { isBlank } from '../utils/helpers.js';
import { normalizeDatetimeLocalValue } from '../utils/datetime.js';
import { toTSV, parseTSV } from '../utils/tsv.js';

export const clipboardMethods = {
  _getSelectionMatrix(sel) {
    const out = [];
    for (let rr = sel.r1; rr <= sel.r2; rr++) {
      const rowId = this._view.viewRowIds[rr];
      const row = this._rowMap.get(rowId);
      const rowArr = [];
      for (let cc = sel.c1; cc <= sel.c2; cc++) {
        const colId = this._view.viewColIds[cc];
        rowArr.push(row?.values?.[colId] ?? "");
      }
      out.push(rowArr);
    }
    return out;
  },

  _setCellByView(viewR, viewC, rawValue) {
    const colId = this._view.viewColIds[viewC];
    const rowId = this._view.viewRowIds[viewR];
    const col = this._colById(colId);
    const row = this._rowMap.get(rowId);
    if (!col || !row) return null;
    if (!this._canEditCol(col)) return null;

    const key = `${rowId}|${colId}`;
    const lock = this._locks.get(key);
    if (lock?.userId && lock.userId !== this.userId) return null;
    if (this._conflicts.has(key)) return null;

    let v = rawValue;
    if (col.type === "number") v = isBlank(v) ? "" : (Number.isNaN(Number(v)) ? String(v) : Number(v));
    else if (col.type === "datetime") v = isBlank(v) ? "" : normalizeDatetimeLocalValue(v);
    else v = String(v ?? "");

    const oldValue = row.values?.[colId] ?? "";
    if (oldValue === v) return null;

    row.values[colId] = v;
    return { rowId, colId, value: v };
  },

  _clearSelection() {
    const sel = this._normalizeSel(this.state.selection);
    const changes = [];
    for (let rr = sel.r1; rr <= sel.r2; rr++) {
      for (let cc = sel.c1; cc <= sel.c2; cc++) {
        const ch = this._setCellByView(rr, cc, "");
        if (ch) changes.push(ch);
      }
    }
    if (changes.length) {
      for (const ch of changes) this._saveCellToServer(ch.rowId, ch.colId, ch.value);
      this._flushPending().catch(console.error);
    }
  },

  _onCopy(e) {
    const matrix = this._getSelectionMatrix(this._normalizeSel(this.state.selection));
    e.clipboardData.setData("text/plain", toTSV(matrix));
    e.preventDefault();
    this._setStatus("Copied");
  },

  _onCut(e) {
    if (this.readOnly) return;
    this._onCopy(e);
    this._clearSelection();
    this._renderGrid({ full: false });
    this._setStatus("Cut");
  },

  _onPaste(e) {
    if (this.readOnly) return;

    const text = e.clipboardData.getData("text/plain");
    if (!text) return;

    const data = parseTSV(text);
    const startR = this.state.active.r;
    const startC = this.state.active.c;

    const maxR = this._view.viewRowIds.length - 1;
    const maxC = this._view.viewColIds.length - 1;

    const changes = [];
    for (let r = 0; r < data.length; r++) {
      for (let c = 0; c < data[r].length; c++) {
        const rr = startR + r;
        const cc = startC + c;
        if (rr > maxR || cc > maxC) continue;
        const ch = this._setCellByView(rr, cc, data[r][c]);
        if (ch) changes.push(ch);
      }
    }

    if (changes.length) {
      for (const ch of changes) this._saveCellToServer(ch.rowId, ch.colId, ch.value);
      this._flushPending().catch(console.error);
      this._recomputeView();
      this._computeRowMeta();
      this._renderGrid({ full: false });
      this._setStatus("Pasted");
    }
    e.preventDefault();
  },
};
