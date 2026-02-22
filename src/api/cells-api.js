/**
 * Server API methods for cell save and batch flush.
 */
export const cellsApiMethods = {
  async _saveCellToServer(rowId, colId, value) {
    const key = `${rowId}|${colId}`;
    this._pending.set(key, { rowId, colId, value, queuedAt: Date.now() });
    this._flushDebounced();
  },

  /**
   * Immediately queue a cell update and flush to server (no debounce).
   * Used on commit so the value reaches the DB before we clear typing/lock.
   */
  async _flushNow(rowId, colId, value) {
    const key = `${rowId}|${colId}`;
    this._pending.set(key, { rowId, colId, value, queuedAt: Date.now() });
    await this._flushPending();
  },

  async _flushPending() {
    if (this._flushInflight) {
      // If already flushing, wait for it to finish then retry (max 3 s)
      await new Promise(r => {
        let waited = 0;
        const check = () => {
          if (!this._flushInflight || waited >= 3000) return r();
          waited += 50;
          setTimeout(check, 50);
        };
        check();
      });
      if (this._pending.size === 0) return;
    }
    if (this._pending.size === 0) return;

    this._flushInflight = true;
    try {
      // Prepare up to N updates, but at most one per row in each call
      const picked = [];
      const pickedRowIds = new Set();

      for (const [key, u] of this._pending.entries()) {
        if (picked.length >= this.config.serverFlushBatchMax) break;
        if (pickedRowIds.has(u.rowId)) continue;
        pickedRowIds.add(u.rowId);

        const baseRowVer = this._rowVer.get(u.rowId) || null;
        picked.push({ rowId: u.rowId, colId: u.colId, value: u.value, baseRowVer });
      }

      if (!picked.length) return;

      this._setStatus("Saving…");

      const json = await this._api(`/api/auditorRequests/batch`, {
        method: "POST",
        body: { clientId: this.clientId, byUser: this.userId, updates: picked },
      });

      if (!json?.ok) throw new Error(json?.error || "Batch save failed");

      const results = Array.isArray(json.results) ? json.results : [];
      let changedUi = false;

      for (const r of results) {
        const k = `${r.rowId}|${r.colId}`;
        this._pending.delete(k);

        if (r.updated) {
          const row = this._rowMap.get(r.rowId);
          if (row) {
            row.values[r.colId] = r.value;
            row.rowVer = r.rowVer;
            row.updatedAt = r.updatedAt;
            row.updatedBy = r.updatedBy;
          }
          this._rowVer.set(r.rowId, r.rowVer);
          this._conflicts.delete(k);
          changedUi = true;
        } else if (r.conflict) {
          const row = this._rowMap.get(r.rowId);
          const mine = this._pending.get(k)?.value;
          const myLastValue = (mine != null ? mine : row?.values?.[r.colId]);

          this._conflicts.set(k, {
            rowId: r.rowId,
            colId: r.colId,
            mine: myLastValue,
            server: r.currentValue,
            updatedAt: r.currentUpdatedAt,
            updatedBy: r.currentUpdatedBy,
            currentRowVer: r.currentRowVer,
          });

          if (row) {
            row.values[r.colId] = r.currentValue;
            row.rowVer = r.currentRowVer;
            row.updatedAt = r.currentUpdatedAt;
            row.updatedBy = r.currentUpdatedBy;
          }
          this._rowVer.set(r.rowId, r.currentRowVer);

          changedUi = true;

          this._toast(
            `Save conflict on "${this._colById(r.colId)?.name || r.colId}" (row ${this._view.viewRowIds.indexOf(r.rowId)+1 || "?"}).`,
            { kind: "warn", detail: `Updated by ${r.currentUpdatedBy || "someone"} at ${r.currentUpdatedAt || ""}. Click the red cell to resolve.` }
          );
        }
      }

      if (this._pending.size === 0) this._setStatus("Saved");
      else this._setStatus(`Saving… (${this._pending.size})`);

      if (changedUi) {
        this._recomputeView();
        this._computeRowMeta();
        this._renderGrid({ full: false });
      }
    } catch (e) {
      console.error(e);
      this._toast("Save failed (network/server).", { kind: "error", detail: String(e?.message || e) });
      this._setStatus("Save failed");
    } finally {
      this._flushInflight = false;
      if (this._pending.size) {
        this._flushDebounced();
      }
    }
  },
};
