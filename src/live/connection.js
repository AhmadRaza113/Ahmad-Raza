/**
 * SignalR connection management — connect, disconnect, and live-status pill.
 */
export const connectionMethods = {
  async _connectLive() {
    if (!window.signalR) {
      this._toast("SignalR client library not loaded.", { kind: "error" });
      return;
    }

    try {
      const neg = await this._api(`/api/negotiate?clientId=${encodeURIComponent(this.clientId)}&userId=${encodeURIComponent(this.userId)}`, { method: "POST" });
      if (!neg?.url || !neg?.accessToken) throw new Error("Negotiate did not return url/accessToken.");

      const conn = new window.signalR.HubConnectionBuilder()
        .withUrl(neg.url, { accessTokenFactory: () => neg.accessToken })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 15000])
        .configureLogging(window.signalR.LogLevel.Information)
        .build();

      conn.on("gridPatch", (msg) => this._onGridPatch(msg));
      conn.on("gridRowAdded", (msg) => this._onGridRowAdded(msg));
      conn.on("gridRowsDeleted", (msg) => this._onGridRowsDeleted(msg));
      conn.on("gridLockChanged", (msg) => this._onGridLockChanged(msg));
      conn.on("gridTyping", (msg) => this._onGridTyping(msg));

      conn.onreconnecting(() => this._setLive(false));
      conn.onreconnected(async () => {
        this._setLive(true);
        // Reload all rows to catch any adds/deletes/edits that happened during the outage
        try {
          await this._loadRowsFromServer();
          this._normalizeState();
          this._recomputeView();
          this._computeRowMeta();
          this._renderGrid({ full: true, persist: false });
          this._toast("Reconnected — data resynced.", { kind: "ok" });
        } catch {}
      });
      conn.onclose(() => this._setLive(false));

      await conn.start();
      this._hub = conn;
      this._setLive(true);
      this._toast("Live connection established.", { kind: "ok" });
    } catch (e) {
      console.error(e);
      this._setLive(false);
      this._toast("Live connection failed.", { kind: "error", detail: String(e?.message || e) });
    }
  },

  _disconnectLive() {
    try {
      if (this._hub) {
        this._hub.stop().catch(() => {});
        this._hub = null;
      }
    } catch {}
    this._setLive(false);
  },

  _setLive(connected) {
    this._liveConnected = !!connected;
    this.dispatchEvent(new CustomEvent("live", { detail: { connected: this._liveConnected } }));
    const pill = this.shadowRoot.querySelector("[data-live]");
    if (pill) {
      pill.textContent = this._liveConnected ? "Live: Connected" : "Live: Disconnected";
      pill.style.background = this._liveConnected ? "rgba(34,197,94,.10)" : "rgba(239,68,68,.10)";
      pill.style.borderColor = this._liveConnected ? "rgba(34,197,94,.25)" : "rgba(239,68,68,.25)";
      pill.style.color = this._liveConnected ? "#166534" : "#991b1b";
    }
  },
};
