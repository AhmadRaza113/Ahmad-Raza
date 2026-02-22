// src/live/hub.js
// GridHub — manages the SignalR connection to the auditor-grid-api hub.
//
// Depends on `window.signalR` being available (load @microsoft/signalr via
// CDN or import-map before sheet-grid.js).
//
// Hub URL convention: `{api-base}/hubs/grid`
// Needs verification: confirm hub route with the auditor-grid-api team.

/* global signalR */

export class GridHub {
  /**
   * @param {{
   *   base:               string,   — api-base value
   *   clientId:           string,   — client-id value
   *   userId:             string,   — user-id value
   *   onRowUpdated:       function, — called with RowUpdated payload
   *   onRowLocked:        function, — called with RowLocked payload
   *   onRowUnlocked:      function, — called with RowUnlocked payload
   *   onConflictDetected: function, — called with ConflictDetected payload
   *   onConnected:        function, — called when connection is established
   *   onDisconnected:     function(reason: string), — called on disconnect
   * }} options
   */
  constructor(options) {
    this._opts       = options;
    this._connection = null;
  }

  /** Builds the HubConnection and starts it.  Idempotent — safe to call once. */
  start() {
    const url = `${this._opts.base.replace(/\/$/, '')}/hubs/grid`;

    this._connection = new signalR.HubConnectionBuilder()
      .withUrl(url, {
        headers: {
          'X-Client-Id': this._opts.clientId,
          'X-User-Id':   this._opts.userId,
        },
      })
      .withAutomaticReconnect()
      .build();

    // Server → client event registrations (exact casing must match server)
    this._connection.on('RowUpdated',       (p) => this._opts.onRowUpdated(p));
    this._connection.on('RowLocked',        (p) => this._opts.onRowLocked(p));
    this._connection.on('RowUnlocked',      (p) => this._opts.onRowUnlocked(p));
    this._connection.on('ConflictDetected', (p) => this._opts.onConflictDetected(p));

    this._connection.onclose((err) =>
      this._opts.onDisconnected(err?.message ?? 'Connection closed'));

    this._connection.onreconnected(() => this._opts.onConnected());

    this._connection
      .start()
      .then(() => this._opts.onConnected())
      .catch((err) => this._opts.onDisconnected(err.message));
  }

  /** Gracefully closes the connection. */
  stop() {
    this._connection?.stop();
  }
}
