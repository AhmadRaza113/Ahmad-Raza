/**
 * View recomputation — filter rows by search/filters, apply sort, clamp selection.
 */
import { isBlank, containsCI, startsCI, equalsCI, clamp } from '../utils/helpers.js';
import { toDatetimeLocalValue, normalizeDatetimeLocalValue } from '../utils/datetime.js';
import { valueKeyForFilter } from '../utils/format.js';

export const viewMethods = {
  _isFilterActive(colId) {
    const f = this.state.filters?.[colId];
    if (!f) return false;
    if (f.mode === "none") return false;
    if (f.mode === "text") return !isBlank(f.value);
    if (f.mode === "range") return !(isBlank(f.min) && isBlank(f.max) && isBlank(f.from) && isBlank(f.to));
    if (f.mode === "blanks") return !!(f.blanks || f.nonblanks);
    if (f.mode === "values") return Array.isArray(f.include) && f.include.length > 0;
    return true;
  },

  _recomputeView() {
    const s = this.state;


    this._view.viewColIds = s.columnOrder.filter(id => !s.colHidden[id]);

    let rowIds = [...s.rowOrder].filter(id => !s.rowHidden[id]);
    rowIds = rowIds.filter(id => {
      const r = s.rows.find(x => x.id === id);
      return r ? !r.hidden : false;
    });

    rowIds = rowIds.filter(rowId => {
      const row = s.rows.find(x => x.id === rowId);
      if (!row) return false;

      if (s.search && s.search.trim()) {
        const q = s.search.trim().toLowerCase();
        const ok = this._view.viewColIds.some(colId => containsCI(row.values[colId], q));
        if (!ok) return false;
      }

      for (const [colId, f] of Object.entries(s.filters || {})) {
        if (!f || f.mode === "none") continue;
        const col = this._colById(colId);
        if (!col) continue;

        const vRaw = row.values?.[colId];
        const v = (col.type === "datetime") ? toDatetimeLocalValue(vRaw) : vRaw;

        if (f.mode === "values") {
          const set = new Set(f.include ?? []);
          const key = valueKeyForFilter(v);
          if (!set.has(key)) return false;
          continue;
        }

        if (f.mode === "blanks") {
          if (f.blanks === true && !isBlank(v)) return false;
          if (f.nonblanks === true && isBlank(v)) return false;
          continue;
        }

        if (f.mode === "range") {
          if (col.type === "number") {
            const n = (v === "" || v == null) ? null : Number(v);
            if (!isBlank(f.min) && (n == null || n < Number(f.min))) return false;
            if (!isBlank(f.max) && (n == null || n > Number(f.max))) return false;
            continue;
          }
          if (col.type === "datetime") {
            const d = toDatetimeLocalValue(v);
            const from = isBlank(f.from) ? "" : normalizeDatetimeLocalValue(f.from);
            const to = isBlank(f.to) ? "" : normalizeDatetimeLocalValue(f.to);
            if (from && (!d || d < from)) return false;
            if (to && (!d || d > to)) return false;
            if ((from || to) && !d) return false;
            continue;
          }
        }

        if (f.mode === "text") {
          const val = String(v ?? "");
          if (f.op === "contains" && !containsCI(val, f.value)) return false;
          if (f.op === "equals" && !equalsCI(val, f.value)) return false;
          if (f.op === "starts" && !startsCI(val, f.value)) return false;
          continue;
        }
      }
      return true;
    });

    if (s.sorts && s.sorts.length) {
      const sorts = s.sorts.slice();
      rowIds.sort((a, b) => {
        const ra = s.rows.find(x => x.id === a);
        const rb = s.rows.find(x => x.id === b);
        for (const sort of sorts) {
          const col = this._colById(sort.colId);
          if (!col) continue;
          const va = ra?.values?.[sort.colId];
          const vb = rb?.values?.[sort.colId];
          let cmp = 0;

          if (col.type === "number") {
            const na = va == null || va === "" ? Number.NEGATIVE_INFINITY : Number(va);
            const nb = vb == null || vb === "" ? Number.NEGATIVE_INFINITY : Number(vb);
            cmp = na - nb;
          } else if (col.type === "datetime") {
            cmp = toDatetimeLocalValue(va).localeCompare(toDatetimeLocalValue(vb));
          } else {
            cmp = String(va ?? "").localeCompare(String(vb ?? ""), undefined, { sensitivity: "base" });
          }

          if (cmp !== 0) return sort.dir === "asc" ? cmp : -cmp;
        }
        return 0;
      });
    } else {
      // No user-defined sorts — apply invisible default: sort by backend seqNum
      // (ascending, numeric). This keeps rows in logical request-number order
      // without exposing seqNum as a visible column or sort badge.
      rowIds.sort((a, b) => {
        const ra = s.rows.find(x => x.id === a);
        const rb = s.rows.find(x => x.id === b);
        const na = Number(ra?.values?.seqNum ?? 0) || 0;
        const nb = Number(rb?.values?.seqNum ?? 0) || 0;
        return na - nb;
      });
    }

    this._view.viewRowIds = rowIds;

    const maxR = Math.max(0, this._view.viewRowIds.length - 1);
    const maxC = Math.max(0, this._view.viewColIds.length - 1);

    this.state.active.r = clamp(this.state.active.r, 0, maxR);
    this.state.active.c = clamp(this.state.active.c, 0, maxC);

    const sel = this.state.selection;
    sel.r1 = clamp(sel.r1, 0, maxR);
    sel.r2 = clamp(sel.r2, 0, maxR);
    sel.c1 = clamp(sel.c1, 0, maxC);
    sel.c2 = clamp(sel.c2, 0, maxC);
  },
};
