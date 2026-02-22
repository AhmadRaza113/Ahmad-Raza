/**
 * Server API methods for cell-level locking (acquire, renew, release).
 */
export const locksApiMethods = {
  async _acquireLock(rowId, colId) {
    const json = await this._api(`/api/locks/acquire`, {
      method: "POST",
      body: { clientId: this.clientId, rowId, colId, userId: this.userId, ttlSeconds: this.config.lockTtlSeconds },
    });

    if (json?.acquired) {
      const key = `${rowId}|${colId}`;
      this._locks.set(key, { userId: this.userId, acquiredAtUtc: new Date().toISOString(), ttlSeconds: this.config.lockTtlSeconds, owned: true });
      await this._startLockRenew(rowId, colId);
      return { acquired: true };
    }

    if (json?.holder?.userId) {
      this._locks.set(`${rowId}|${colId}`, { ...json.holder, owned: json.holder.userId === this.userId });
    }

    return { acquired: false, holder: json?.holder || null };
  },

  async _renewLock(rowId, colId) {
    const json = await this._api(`/api/locks/renew`, {
      method: "POST",
      body: { clientId: this.clientId, rowId, colId, userId: this.userId, ttlSeconds: this.config.lockTtlSeconds },
    });
    return json;
  },

  async _releaseLock(rowId, colId) {
    const json = await this._api(`/api/locks/release`, {
      method: "POST",
      body: { clientId: this.clientId, rowId, colId, userId: this.userId },
    });
    return json;
  },

  async _startLockRenew(rowId, colId) {
    await this._releaseOwnedLock().catch(() => {});
    const timerId = window.setInterval(async () => {
      try {
        if (!this.state.editing || this.state.editing.rowId !== rowId || this.state.editing.colId !== colId) return;
        const res = await this._renewLock(rowId, colId);
        if (!res?.renewed) {
          this._toast("You lost the lock on this cell.", { kind: "warn" });
          this._locks.set(`${rowId}|${colId}`, { ...(res?.holder || {}), owned: false });
          await this._releaseOwnedLock().catch(() => {});
          this._cancelEdit();
        }
      } catch {
        // ignore transient renew failures
      }
    }, this.config.lockRenewEveryMs);

    this._ownedLock = { rowId, colId, timerId };
  },

  async _releaseOwnedLock() {
    if (!this._ownedLock) return;
    const { rowId, colId, timerId } = this._ownedLock;
    this._ownedLock = null;
    try { clearInterval(timerId); } catch {}
    try { await this._releaseLock(rowId, colId); } catch {}
  },
};
