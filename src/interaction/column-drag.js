/**
 * Column drag-and-drop reorder.
 */
import { clamp } from '../utils/helpers.js';

export const columnDragMethods = {
  _getHeaderThRects() {
    const ths = [...this.shadowRoot.querySelectorAll('thead th[data-colid]')];
    return ths.map((th) => ({ th, colId: th.dataset.colid, rect: th.getBoundingClientRect() }));
  },

  _hitTestHeaderIndexByX(clientX) {
    const rects = this._getHeaderThRects();
    if (!rects.length) return -1;
    for (let i = 0; i < rects.length; i++) {
      const mid = (rects[i].rect.left + rects[i].rect.right) / 2;
      if (clientX < mid) return i;
    }
    return rects.length - 1;
  },

  _startColDrag(colId, e) {
    const fromIndex = this._view.viewColIds.indexOf(colId);
    if (fromIndex < 0) return;

    const ghost = document.createElement("div");
    ghost.className = "colDragGhost";
    ghost.textContent = this._colById(colId)?.name ?? colId;
    document.body.appendChild(ghost);

    const moveGhost = (ev) => {
      ghost.style.left = `${ev.clientX}px`;
      ghost.style.top = `${ev.clientY}px`;
    };
    moveGhost(e);

    this._colDrag = { colId, fromIndex, overIndex: fromIndex, ghostEl: ghost };

    const onMove = (ev) => {
      moveGhost(ev);

      const over = this._hitTestHeaderIndexByX(ev.clientX);

      this.shadowRoot.querySelectorAll("th.colDropTarget").forEach(x => x.classList.remove("colDropTarget"));

      if (over >= 0) {
        this._colDrag.overIndex = over;
        const ths = [...this.shadowRoot.querySelectorAll("thead th[data-colid]")];
        const target = ths[over];
        if (target) target.classList.add("colDropTarget");
      }
    };

    const onUp = () => {
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", onUp, true);

      this.shadowRoot.querySelectorAll("th.colDropTarget").forEach(x => x.classList.remove("colDropTarget"));
      ghost.remove();

      const drag = this._colDrag;
      this._colDrag = null;
      if (!drag) return;

      if (drag.fromIndex !== drag.overIndex) {
        const oldView = [...this._view.viewColIds];

        const id = drag.colId;
        const order = [...this.state.columnOrder];
        const from = order.indexOf(id);
        if (from >= 0) {
          order.splice(from, 1);

          const overColId = oldView[drag.overIndex];
          const to = order.indexOf(overColId);
          if (to >= 0) order.splice(to, 0, id);
          else order.push(id);

          this.state.columnOrder = order;

          this._recomputeView();
          this._remapSelectionAfterColOrderChange(oldView);
          this._renderGrid({ full: true });
          this._persistUiDebounced();
          this._setStatus("Column moved");
        }
      }
    };

    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", onUp, true);
  },

  _remapSelectionAfterColOrderChange(oldViewColIds) {
    const newView = this._view.viewColIds;

    const activeOldId = oldViewColIds[this.state.active.c];
    const sel = this._normalizeSel(this.state.selection);
    const selectedIds = oldViewColIds.slice(sel.c1, sel.c2 + 1);

    const newActiveIndex = activeOldId ? newView.indexOf(activeOldId) : -1;
    if (newActiveIndex >= 0) this.state.active.c = newActiveIndex;
    else this.state.active.c = clamp(this.state.active.c, 0, Math.max(0, newView.length - 1));

    const idxs = selectedIds.map(id => newView.indexOf(id)).filter(i => i >= 0);
    if (idxs.length) {
      const min = Math.min(...idxs);
      const max = Math.max(...idxs);
      this.state.selection.c1 = min;
      this.state.selection.c2 = max;
    } else {
      this.state.selection.c1 = this.state.active.c;
      this.state.selection.c2 = this.state.active.c;
    }
  },
};
