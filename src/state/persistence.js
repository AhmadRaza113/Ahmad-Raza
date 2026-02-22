/**
 * UI state persistence — save/restore column widths, sort, filters, etc. to localStorage.
 */
import { PERSIST_VERSION } from '../config/defaults.js';

export const persistenceMethods = {
  _persistUi() {
    try {
      const s = this.state;
      const payload = {
        version: PERSIST_VERSION,
        ui: {
          sorts: s.sorts,
          filters: s.filters,
          search: s.search,

          columnOrder: s.columnOrder,
          colHidden: s.colHidden,
          colWidths: s.colWidths,
          colLastWidth: s.colLastWidth,
          rowHidden: s.rowHidden,
          rowHeights: s.rowHeights,
        },
      };
      localStorage.setItem(this.storageKey, JSON.stringify(payload));
    } catch {}
  },

  _loadUi() {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return;

    try {
      const obj = JSON.parse(raw);
      if (obj.version !== PERSIST_VERSION) return;
      const ui = obj.ui ?? {};
      this.state.sorts = (ui.sorts ?? []).filter(s => s.colId !== "seqNum");
      this.state.filters = ui.filters ?? {};
      this.state.search = ui.search ?? "";

      this.state.columnOrder = ui.columnOrder ?? [];
      this.state.colHidden = ui.colHidden ?? {};
      this.state.colWidths = ui.colWidths ?? {};
      this.state.colLastWidth = ui.colLastWidth ?? {};
      this.state.rowHidden = ui.rowHidden ?? {};
      this.state.rowHeights = ui.rowHeights ?? {};
    } catch {}
  },
};
