/**
 * Server API methods for broadcasting live typing events to other users.
 */
export const typingApiMethods = {
  async _broadcastTyping(rowId, colId, value) {
    try {
      await this._api('/api/typing', {
        method: 'POST',
        body: {
          clientId: this.clientId,
          rowId,
          colId,
          userId: this.userId,
          value: value ?? "",
        },
      });
    } catch {
      // Typing broadcast failure is non-critical — silently ignore
    }
  },

  _clearRemoteTyping(rowId, colId) {
    const key = `${rowId}|${colId}`;
    this._remoteTyping.delete(key);
  },
};
