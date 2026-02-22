/**
 * Virtual scrolling — row offset calculation, range determination, scroll-into-view.
 */
import { clamp } from '../utils/helpers.js';

export const virtualScrollMethods = {
  _computeRowMeta() {
    const ids = this._view.viewRowIds;
    const heights = new Array(ids.length);
    const offsets = new Array(ids.length + 1);
    offsets[0] = 0;
    for (let i = 0; i < ids.length; i++) {
      const rowId = ids[i];
      const h = this.state.rowHeights[rowId] ?? this.config.defaultRowHeight;
      heights[i] = h;
      offsets[i + 1] = offsets[i] + h;
    }
    this._rowMeta = { heights, offsets, total: offsets[offsets.length - 1], version: (this._rowMeta.version + 1) };
  },

  _findRowIndexAtY(y) {
    const offsets = this._rowMeta.offsets;
    let lo = 0, hi = offsets.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (offsets[mid] <= y) lo = mid + 1;
      else hi = mid;
    }
    return clamp(lo - 1, 0, Math.max(0, offsets.length - 2));
  },

  _calcVirtRange() {
    const wrap = this.shadowRoot.querySelector("[data-gridwrap]");
    if (!wrap) return { start: 0, end: -1 };

    const totalRows = this._view.viewRowIds.length;
    if (!this.config.virtualization || totalRows === 0) return { start: 0, end: totalRows - 1 };

    const scrollTop = wrap.scrollTop;
    const viewH = wrap.clientHeight;

    const startIdx = this._findRowIndexAtY(scrollTop);
    const endIdx = this._findRowIndexAtY(scrollTop + viewH);

    const start = clamp(startIdx - this.config.overscan, 0, totalRows - 1);
    const end = clamp(endIdx + this.config.overscan, 0, totalRows - 1);

    return { start, end };
  },

  _ensureCellVisible(viewR, viewC) {
    const wrap = this.shadowRoot.querySelector("[data-gridwrap]");
    if (!wrap) return;

    const rowTop = this._rowMeta.offsets[viewR] ?? 0;
    const rowBottom = this._rowMeta.offsets[viewR + 1] ?? (rowTop + (this._rowMeta.heights[viewR] ?? this.config.defaultRowHeight));

    const top = wrap.scrollTop;
    const bottom = top + wrap.clientHeight;

    if (rowTop < top) wrap.scrollTop = rowTop;
    else if (rowBottom > bottom) wrap.scrollTop = Math.max(0, rowBottom - wrap.clientHeight);

    this._renderBody();
    const td = this._getCellTd(viewR, viewC);
    if (td) td.scrollIntoView({ block: "nearest", inline: "nearest" });
  },
};
