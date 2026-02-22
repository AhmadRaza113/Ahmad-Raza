/**
 * Column actions — hide, show, auto-fit (single + all).
 */
import { clamp } from '../utils/helpers.js';
import { measureTextWidth } from '../utils/dom.js';

export const columnActionMethods = {
  _hideColumn(colId) {
    const w = this.state.colWidths[colId] ?? 160;
    if (w > this.config.minColWidth) this.state.colLastWidth[colId] = w;
    this.state.colHidden[colId] = true;
    this._recomputeView();
    this._renderGrid({ full: true });
    this._persistUiDebounced();
  },

  _showColumn(colId) {
    delete this.state.colHidden[colId];
    const last = this.state.colLastWidth[colId];
    if (last != null) this.state.colWidths[colId] = last;
    this._recomputeView();
    this._renderGrid({ full: true });
    this._persistUiDebounced();
  },

  _autoFitColumns() {
    const font = "13px Segoe UI, Arial, sans-serif";
    const sampleCount = Math.min(80, this._view.viewRowIds.length);
    for (const colId of this._view.viewColIds) this._autoFitSingleColumn(colId, { font, sampleCount, rerender: false });
    this._renderGrid({ full: true });
    this._persistUiDebounced();
    this._setStatus("Columns auto-fit");
  },

  _autoFitSingleColumn(colId, opts = {}) {
    const font = opts.font || "13px Segoe UI, Arial, sans-serif";
    const sampleCount = opts.sampleCount ?? Math.min(80, this._view.viewRowIds.length);
    const rerender = opts.rerender !== false;

    const col = this._colById(colId);
    if (!col) return;

    let w = measureTextWidth(col.name, "12px Segoe UI, Arial, sans-serif") + 70;
    for (let i = 0; i < sampleCount; i++) {
      const rowId = this._view.viewRowIds[i];
      const row = this.state.rows.find(r => r.id === rowId);
      const val = this._formatValue(col, row?.values?.[colId]);
      w = Math.max(w, measureTextWidth(val, font) + 40);
    }

    this.state.colWidths[colId] = clamp(Math.ceil(w), this.config.minColWidth, 640);
    this.state.colLastWidth[colId] = this.state.colWidths[colId];

    if (rerender) {
      const colEl = this.shadowRoot.querySelector(`col[data-colid="${colId}"]`);
      if (colEl) colEl.style.width = `${this.state.colWidths[colId]}px`;
      this._renderGrid({ full: true });
      this._persistUiDebounced();
      this._setStatus(`Auto-fit: ${col.name}`);
    }
  },
};
