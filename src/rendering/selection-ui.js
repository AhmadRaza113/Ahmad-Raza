/**
 * Selection UI — highlight active/range/anchor/fillPreview cells, attach fill handle.
 */
import { clamp } from '../utils/helpers.js';

export const selectionUiMethods = {
  _normalizeSel(sel) {
    const r1 = Math.min(sel.r1, sel.r2);
    const r2 = Math.max(sel.r1, sel.r2);
    const c1 = Math.min(sel.c1, sel.c2);
    const c2 = Math.max(sel.c1, sel.c2);
    return { r1, c1, r2, c2 };
  },

  _getCellTd(r, c) {
    return this.shadowRoot.querySelector(`td[data-r="${r}"][data-c="${c}"]`);
  },

  _updateSelectionClasses() {
    this.shadowRoot.querySelectorAll("td.active,td.range,td.anchor,td.fillPreview").forEach(el =>
      el.classList.remove("active", "range", "anchor", "fillPreview")
    );

    const sel = this._normalizeSel(this.state.selection);

    const start = this._virt.start ?? 0;
    const end = this._virt.end ?? (this._view.viewRowIds.length - 1);

    const rr1 = clamp(sel.r1, start, end);
    const rr2 = clamp(sel.r2, start, end);

    for (let rr = rr1; rr <= rr2; rr++) {
      for (let cc = sel.c1; cc <= sel.c2; cc++) {
        const td = this._getCellTd(rr, cc);
        if (td) td.classList.add("range");
      }
    }

    const act = this._getCellTd(this.state.active.r, this.state.active.c);
    if (act) act.classList.add("active");

    const anc = this._getCellTd(sel.r1, sel.c1);
    if (anc) anc.classList.add("anchor");
  },

  _attachFillHandle() {
    this.shadowRoot.querySelectorAll(".fillHandle").forEach(x => x.remove());
    if (this.readOnly) return;

    const td = this._getCellTd(this.state.active.r, this.state.active.c);
    const cell = td?.querySelector(".cell");
    if (!cell) return;

    const handle = document.createElement("div");
    handle.className = "fillHandle";
    cell.appendChild(handle);
  },
};
