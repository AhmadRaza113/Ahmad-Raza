// src/api/client.js
// ApiClient — thin fetch-based REST client for the auditor-grid API.
//
// Every mutating request includes `clientId` in the JSON body so the server
// can echo it back in SignalR broadcasts, letting the sender distinguish its
// own updates from updates originating elsewhere.
//
// The X-Client-Id request header carries the same value for server-side
// idempotency / tracing (Needs verification: whether the server enforces this).

export class ApiClient {
  /**
   * @param {{ base: string, clientId: string }} options
   *   base     — value of the `api-base` attribute (no trailing slash)
   *   clientId — value of the `client-id` attribute
   */
  constructor({ base, clientId }) {
    this._base     = base.replace(/\/$/, '');
    this._clientId = clientId;
  }

  // ── Read ──────────────────────────────────────────────────────────────

  /** Fetches all rows.            @returns {Promise<object[]>} */
  getRows()          { return this._req('GET', '/rows'); }

  /** Fetches column definitions.  @returns {Promise<object[]>} */
  getColumns()       { return this._req('GET', '/columns'); }

  /**
   * Fetches a single row by ID.
   * @param {string} rowId
   * @returns {Promise<object>}
   */
  getRow(rowId) {
    return this._req('GET', `/rows/${enc(rowId)}`);
  }

  // ── Write ─────────────────────────────────────────────────────────────

  /**
   * Updates a row.  The server uses `rowVer` for optimistic-concurrency
   * and returns 409 Conflict if another write has incremented it since.
   *
   * @param {string} rowId
   * @param {{ rowVer: number, values: object, clientId: string }} body
   * @returns {Promise<object>}  updated row
   */
  updateRow(rowId, body) {
    return this._req('PUT', `/rows/${enc(rowId)}`, body);
  }

  /**
   * Acquires an edit lock on a row.
   * @param {string} rowId
   * @param {string} clientId
   * @returns {Promise<void>}
   */
  lockRow(rowId, clientId) {
    return this._req('POST', `/rows/${enc(rowId)}/lock`, { clientId });
  }

  /**
   * Releases an edit lock on a row.
   * @param {string} rowId
   * @param {string} clientId
   * @returns {Promise<void>}
   */
  unlockRow(rowId, clientId) {
    return this._req('DELETE', `/rows/${enc(rowId)}/lock`, { clientId });
  }

  // ── Internal ──────────────────────────────────────────────────────────

  async _req(method, path, body) {
    const init = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id':  this._clientId,
      },
    };
    if (body !== undefined && method !== 'GET') {
      init.body = JSON.stringify(body);
    }
    const res = await fetch(`${this._base}${path}`, init);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${method} ${path} → ${res.status}: ${text}`);
    }
    const ct = res.headers.get('Content-Type') ?? '';
    if (ct.includes('application/json')) return res.json();
  }
}

function enc(id) { return encodeURIComponent(id); }
