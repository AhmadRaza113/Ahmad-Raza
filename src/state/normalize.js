/**
 * State normalization — ensures column/row orders match actual data after load.
 */
import { clamp } from '../utils/helpers.js';

export const normalizeMethods = {
  _normalizeState() {
    const colIds = this.state.columns.map(c => c.id);

    if (!this.state.columnOrder || this.state.columnOrder.length === 0) {
      this.state.columnOrder = [...colIds];
    } else {
      const set = new Set(this.state.columnOrder);
      colIds.forEach(id => { if (!set.has(id)) this.state.columnOrder.push(id); });
      this.state.columnOrder = this.state.columnOrder.filter(id => colIds.includes(id));
    }

    for (const c of this.state.columns) {
      if (this.state.colWidths[c.id] == null) this.state.colWidths[c.id] = c.width ?? 160;
      if (this.state.colLastWidth[c.id] == null) this.state.colLastWidth[c.id] = this.state.colWidths[c.id] || 160;
    }

    const rowIds = this.state.rows.map(r => r.id);
    if (!this.state.rowOrder || this.state.rowOrder.length === 0) {
      this.state.rowOrder = [...rowIds];
    } else {
      const set = new Set(this.state.rowOrder);
      rowIds.forEach(id => { if (!set.has(id)) this.state.rowOrder.push(id); });
      this.state.rowOrder = this.state.rowOrder.filter(id => rowIds.includes(id));
    }

    const maxR = Math.max(0, rowIds.length - 1);
    const maxC = Math.max(0, colIds.length - 1);

    this.state.active = { r: clamp(this.state.active.r, 0, maxR), c: clamp(this.state.active.c, 0, maxC) };
    this.state.selection = { r1: 0, c1: 0, r2: 0, c2: 0 };
    this.state.editing = null;
  },
};
