/**
 * Row CRUD actions — add and delete rows (UI → server).
 */
export const rowActionMethods = {
  async _addRow() {
    if (this.readOnly) return;
    try {
      const row = await this._addRowServer();
      if (row?.id && !this.state.rows.some(r => r.id === row.id)) {
        this.state.rows.unshift({
          id: row.id,
          clientId: row.clientId,
          rowVer: row.rowVer,
          updatedAt: row.updatedAt,
          updatedBy: row.updatedBy,
          values: {
            ...(row.values || {}),
            ...(row.reqNo != null ? { req_no: row.reqNo } : {}),
          },
        });
        this._rowVer.set(row.id, row.rowVer);
        this._syncRowMap();
        this.state.rowOrder = [row.id, ...this.state.rowOrder.filter(id => id !== row.id)];
      }
      this._recomputeView();
      this._computeRowMeta();
      this._renderGrid({ full: true });
      this._toast("Row added.", { kind: "ok" });
    } catch (e) {
      console.error(e);
      this._toast("Add row failed.", { kind: "error", detail: String(e?.message || e) });
    }
  },

  async _deleteSelectedRows() {
    if (this.readOnly) return;
    const sel = this._normalizeSel(this.state.selection);
    const ids = new Set();
    for (let rr = sel.r1; rr <= sel.r2; rr++) {
      const rowId = this._view.viewRowIds[rr];
      if (rowId) ids.add(rowId);
    }
    if (!ids.size) return;

    try {
      await this._deleteRowsServer([...ids]);

      this.state.rows = this.state.rows.filter(r => !ids.has(r.id));
      this._syncRowMap();
      this.state.rowOrder = this.state.rowOrder.filter(id => !ids.has(id));
      for (const id of ids) this._rowVer.delete(id);

      this._recomputeView();
      this._computeRowMeta();
      this._renderGrid({ full: true });
      this._toast("Rows deleted.", { kind: "ok" });
    } catch (e) {
      console.error(e);
      this._toast("Delete rows failed.", { kind: "error", detail: String(e?.message || e) });
    }
  },
};
