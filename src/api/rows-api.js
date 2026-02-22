/**
 * Server API methods for row CRUD operations.
 */
export const rowsApiMethods = {
  async _loadRowsFromServer() {
    try {
      const json = await this._api(`/api/auditorRequests?clientId=${encodeURIComponent(this.clientId)}`);
      if (!json?.ok) throw new Error(json?.error || "Failed to load rows");

      const rows = Array.isArray(json.rows) ? json.rows : [];
      this.state.rows = rows.map(r => ({
        id: r.id,
        clientId: r.clientId,
        rowVer: r.rowVer,
        updatedAt: r.updatedAt,
        updatedBy: r.updatedBy,
        values: {
          ...(r.values || {}),
          // reqNo and seqNum are auto-generated DB columns returned as top-level fields
          ...(r.reqNo  != null ? { req_no: r.reqNo }   : {}),
          ...(r.seqNum != null ? { seqNum: r.seqNum }  : {}),
        },
      }));

      // keep rowVer cache
      this._rowVer.clear();
      for (const r of this.state.rows) this._rowVer.set(r.id, r.rowVer);
      this._syncRowMap();

      // reset any pending/conflicts/locks/typing for safety
      this._pending.clear();
      this._conflicts.clear();
      this._locks.clear();
      this._remoteTyping.clear();
      this._ownedLock = null;

      this._setStatus(`Loaded (${rows.length})`);
    } catch (e) {
      console.error(e);
      this._toast("Failed to load rows from server.", { kind: "error", detail: String(e?.message || e) });
      this._setStatus("Load failed");
      this.state.rows = [];
      this._syncRowMap();
    }
  },

  /**
   * Fetch fresh data for a single row from the server and update state in-place.
   * Called as a fallback when the gridPatch SignalR broadcast hasn't arrived after
   * a remote user finishes typing. Uses a rowId query-param if the server supports
   * it; otherwise iterates the full rows response and updates just this one row.
   * Silently ignores network/server errors — gridPatch may still arrive later.
   */
  async _refreshSingleRow(rowId) {
    try {
      const json = await this._api(
        `/api/auditorRequests?clientId=${encodeURIComponent(this.clientId)}&rowId=${encodeURIComponent(rowId)}`
      );
      if (!json?.ok) return;

      const rows = Array.isArray(json.rows) ? json.rows : [];
      // Server may return just the one row (filtered) or all rows — find ours.
      const fresh = rows.find(r => r.id === rowId);
      if (!fresh) return;

      const existing = this._rowMap.get(rowId);
      if (!existing) return;

      // Skip update if we already have the same or a newer version (e.g. gridPatch
      // arrived concurrently and already applied a fresh rowVer).
      if (
        fresh.rowVer != null &&
        existing.rowVer != null &&
        Number(fresh.rowVer) <= Number(existing.rowVer)
      ) return;

      const freshValues = {
        ...(fresh.values || {}),
        ...(fresh.reqNo  != null ? { req_no: fresh.reqNo }  : {}),
        ...(fresh.seqNum != null ? { seqNum: fresh.seqNum } : {}),
      };

      existing.values   = freshValues;
      existing.rowVer   = fresh.rowVer;
      existing.updatedAt = fresh.updatedAt;
      existing.updatedBy = fresh.updatedBy;
      this._rowVer.set(rowId, fresh.rowVer);
    } catch {
      // Non-critical — silently ignore; gridPatch may still arrive.
    }
  },

  async _addRowServer() {
    const json = await this._api(`/api/auditorRequests/rows`, {
      method: "POST",
      body: { clientId: this.clientId, byUser: this.userId, values: {} },
    });
    if (!json?.ok) throw new Error(json?.error || "Add row failed");
    return json.row;
  },

  async _deleteRowsServer(rowIds) {
    const json = await this._api(`/api/auditorRequests/rows/delete`, {
      method: "POST",
      body: { clientId: this.clientId, byUser: this.userId, rowIds },
    });
    if (!json?.ok) throw new Error(json?.error || "Delete rows failed");
    return json.deleted || 0;
  },
};
