// src/component.js
// SheetGrid — collaborative spreadsheet grid web component.
//
// Custom element tag : <sheet-grid>
// Observed attributes: api-base | client-id | user-id | storage-key | readonly
// Emitted events     : live (CustomEvent) | toast (CustomEvent)
//
// Source of truth: this file defines the canonical attribute names and event
// contracts. All documentation must be derived from this file, not the reverse.

import { ApiClient } from './api/client.js';
import { GridHub } from './live/hub.js';
import { normalizeRows, normalizeColumns } from './state/normalize.js';
import { InlineEditor } from './editing/inline-editor.js';
import { ConflictModal } from './ui/conflict-modal.js';

export class SheetGrid extends HTMLElement {
  static get observedAttributes() {
    return ['api-base', 'client-id', 'user-id', 'storage-key', 'readonly'];
  }

  constructor() {
    super();
    this._rows    = [];    // normalized Row[]
    this._columns = [];    // normalized Column[]
    this._api     = null;  // ApiClient
    this._hub     = null;  // GridHub
    this._editor  = null;  // InlineEditor
    this._modal   = null;  // ConflictModal

    this.attachShadow({ mode: 'open' });
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  connectedCallback() {
    this._render();
    this._boot();
  }

  disconnectedCallback() {
    this._hub?.stop();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (this.isConnected) this._boot();
  }

  // ── Attribute accessors ─────────────────────────────────────────────────

  get apiBase()    { return this.getAttribute('api-base')    ?? ''; }
  get clientId()   { return this.getAttribute('client-id')   ?? ''; }
  get userId()     { return this.getAttribute('user-id')     ?? ''; }
  get storageKey() { return this.getAttribute('storage-key') ?? ''; }
  get isReadonly() { return this.hasAttribute('readonly'); }

  // ── Bootstrap ───────────────────────────────────────────────────────────

  async _boot() {
    if (!this.apiBase || !this.clientId || !this.userId) return;

    this._api    = new ApiClient({ base: this.apiBase, clientId: this.clientId });
    this._editor = new InlineEditor(this.shadowRoot, {
      onCommit: (edit) => this._commitEdit(edit),
    });
    this._modal  = new ConflictModal(this.shadowRoot, {
      onResolve: (resolution) => this._applyResolution(resolution),
    });

    await this._loadInitialData();
    this._connectHub();
  }

  async _loadInitialData() {
    try {
      const [rows, columns] = await Promise.all([
        this._api.getRows(),
        this._api.getColumns(),
      ]);
      this._rows    = normalizeRows(rows);
      this._columns = normalizeColumns(columns);
      this._renderGrid();
    } catch (err) {
      this._emitToast(`Failed to load grid data: ${err.message}`, 'error');
    }
  }

  // ── Live connection ─────────────────────────────────────────────────────

  _connectHub() {
    this._hub = new GridHub({
      base:               this.apiBase,
      clientId:           this.clientId,
      userId:             this.userId,
      onRowUpdated:       (p) => this._onRowUpdated(p),
      onRowLocked:        (p) => this._onRowLocked(p),
      onRowUnlocked:      (p) => this._onRowUnlocked(p),
      onConflictDetected: (p) => this._onConflictDetected(p),
      onConnected:        ()  => this._setLiveState(true),
      onDisconnected:     (reason) => this._setLiveState(false, reason),
    });
    this._hub.start();
  }

  _setLiveState(connected, reason) {
    this.dispatchEvent(new CustomEvent('live', {
      bubbles:  true,
      composed: true,
      detail:   { connected, ...(reason != null ? { reason } : {}) },
    }));
  }

  // ── SignalR event handlers ───────────────────────────────────────────────

  _onRowUpdated({ rowId, rowVer, values, clientId }) {
    const idx = this._rows.findIndex(r => r.rowId === rowId);
    if (idx === -1) return;
    this._rows[idx] = { ...this._rows[idx], rowVer, values };
    this._renderGrid();
    if (clientId !== this.clientId) {
      this._emitToast(`Row ${rowId} updated by another user.`, 'info');
    }
  }

  _onRowLocked({ rowId, userId }) {
    const idx = this._rows.findIndex(r => r.rowId === rowId);
    if (idx === -1) return;
    this._rows[idx] = { ...this._rows[idx], lockedBy: userId };
    this._renderGrid();
  }

  _onRowUnlocked({ rowId }) {
    const idx = this._rows.findIndex(r => r.rowId === rowId);
    if (idx === -1) return;
    this._rows[idx] = { ...this._rows[idx], lockedBy: null };
    this._renderGrid();
  }

  _onConflictDetected({ rowId, rowVer, serverValues, clientValues, clientId }) {
    if (clientId !== this.clientId) return;
    this._modal.show({ rowId, rowVer, serverValues, clientValues });
  }

  // ── Editing ─────────────────────────────────────────────────────────────

  async _commitEdit({ rowId, colId, value }) {
    if (this.isReadonly) return;
    const row = this._rows.find(r => r.rowId === rowId);
    if (!row) return;
    try {
      await this._api.updateRow(rowId, {
        rowVer:   row.rowVer,
        values:   { ...row.values, [colId]: value },
        clientId: this.clientId,
      });
    } catch (err) {
      this._emitToast(`Save failed: ${err.message}`, 'error');
    }
  }

  async _applyResolution({ rowId, values, rowVer }) {
    try {
      await this._api.updateRow(rowId, {
        rowVer,
        values,
        clientId: this.clientId,
      });
    } catch (err) {
      this._emitToast(`Conflict resolution failed: ${err.message}`, 'error');
    }
  }

  // ── Toast helper ────────────────────────────────────────────────────────

  _emitToast(message, level = 'info') {
    this.dispatchEvent(new CustomEvent('toast', {
      bubbles:  true,
      composed: true,
      detail:   { message, level },
    }));
  }

  // ── Render ──────────────────────────────────────────────────────────────

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host          { display: block; overflow: auto; }
        table          { border-collapse: collapse; width: 100%; }
        th, td         { border: 1px solid #ccc; padding: 4px 8px; font-size: 0.875rem; }
        th             { background: #f4f4f4; font-weight: 600; }
        tr[data-locked]  td { background: #fff3cd; }
        td[data-editing]    { outline: 2px solid #0078d4; }
      </style>
      <table id="grid"><thead></thead><tbody></tbody></table>
    `;
  }

  _renderGrid() {
    const thead = this.shadowRoot.querySelector('thead');
    const tbody = this.shadowRoot.querySelector('tbody');
    if (!thead || !tbody) return;

    thead.innerHTML = `<tr>${
      this._columns.map(c => `<th data-col-id="${c.colId}">${c.label}</th>`).join('')
    }</tr>`;

    tbody.innerHTML = this._rows.map(row => `
      <tr data-row-id="${row.rowId}"${row.lockedBy ? ' data-locked' : ''}>
        ${this._columns.map(col => {
          const val      = row.values[col.colId] ?? '';
          const editable = !this.isReadonly && !row.lockedBy && !col.readonly;
          return `<td
            data-row-id="${row.rowId}"
            data-col-id="${col.colId}"
            ${editable ? 'tabindex="0"' : ''}
          >${val}</td>`;
        }).join('')}
      </tr>
    `).join('');

    if (!this.isReadonly) this._editor?.attach(tbody);
  }
}
