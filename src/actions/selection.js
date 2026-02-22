/**
 * Selection actions — select all, select row, select column.
 */
export const selectionMethods = {
  _selectAll() {
    const maxR = Math.max(0, this._view.viewRowIds.length - 1);
    const maxC = Math.max(0, this._view.viewColIds.length - 1);
    this.state.active = { r: 0, c: 0 };
    this.state.selection = { r1: 0, c1: 0, r2: maxR, c2: maxC };
    this._updateSelectionClasses();
    this._attachFillHandle();
  },

  _selectRow(viewR, { shift = false } = {}) {
    const maxC = Math.max(0, this._view.viewColIds.length - 1);
    if (!shift) {
      this.state.active = { r: viewR, c: 0 };
      this.state.selection = { r1: viewR, c1: 0, r2: viewR, c2: maxC };
    } else {
      const a = this.state.selection;
      this.state.active = { r: viewR, c: 0 };
      this.state.selection = { r1: a.r1, c1: 0, r2: viewR, c2: maxC };
    }
    this._updateSelectionClasses();
    this._attachFillHandle();
  },

  _selectColumn(viewC, { shift = false } = {}) {
    const maxR = Math.max(0, this._view.viewRowIds.length - 1);
    if (!shift) {
      this.state.active = { r: 0, c: viewC };
      this.state.selection = { r1: 0, c1: viewC, r2: maxR, c2: viewC };
    } else {
      const a = this.state.selection;
      this.state.active = { r: 0, c: viewC };
      this.state.selection = { r1: 0, c1: a.c1, r2: maxR, c2: viewC };
    }
    this._updateSelectionClasses();
    this._attachFillHandle();
  },
};
