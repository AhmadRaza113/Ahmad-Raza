/**
 * Sorting actions — toggle sort direction, clear sort per column or all.
 */
export const sortingMethods = {
  _toggleSort(colId) {
    const idx = this.state.sorts.findIndex(s => s.colId === colId);
    if (idx < 0) {
      this.state.sorts.push({ colId, dir: "asc" });
    } else {
      const cur = this.state.sorts[idx].dir;
      if (cur === "asc") this.state.sorts[idx].dir = "desc";
      else this.state.sorts.splice(idx, 1);
    }
    this._recomputeView();
    this._computeRowMeta();
    this._renderGrid({ full: true });
    this._persistUiDebounced();
  },

  _clearSort(colId = null) {
    if (colId) this.state.sorts = this.state.sorts.filter(s => s.colId !== colId);
    else this.state.sorts = [];
    this._recomputeView();
    this._computeRowMeta();
    this._renderGrid({ full: true });
    this._persistUiDebounced();
  },
};
