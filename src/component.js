/* component.js (v12)
 * SheetGrid Web Component — modular architecture.
 * Imports all method modules and assembles the complete <sheet-grid> custom element.
 *
 * ✅ Production-grade POC grid with:
 *   - Excel-like cell selection + editing (single cell editor inside cell)
 *   - Copy/Cut/Paste TSV, Fill handle
 *   - Column resize + auto-fit, row resize
 *   - Column reorder
 *   - Search + Filter + Sort (multi sort)
 *   - Add/Delete rows
 *   - Live parallel editing via SignalR (gridPatch / gridRowAdded / gridRowsDeleted)
 *   - Cell-level locking via Redis locks (gridLockChanged)
 *   - Conflict UI (clear message + choose "Keep mine" or "Accept server")
 *   - Live typing broadcast: real-time keystrokes shown to others via gridTyping
 *   - Save optimization: DB writes on blur/enter/debounce(800ms), NOT per keystroke
 *   - Lock auto-release: TTL 30s, beforeunload beacon, disconnect cleanup
 */

// ─── Config & Utils ─────────────────────────────────────────────────────────
import { DEFAULT_COLS } from './config/columns.js';
import { DEFAULT_CONFIG } from './config/defaults.js';
import { deepClone, debounce, clamp } from './utils/helpers.js';

// ─── Method modules (each exports an object of prototype methods) ───────────
import { apiClientMethods }     from './api/client.js';
import { rowsApiMethods }       from './api/rows-api.js';
import { cellsApiMethods }      from './api/cells-api.js';
import { locksApiMethods }      from './api/locks-api.js';
import { typingApiMethods }     from './api/typing-api.js';

import { connectionMethods }    from './live/connection.js';
import { liveHandlerMethods }   from './live/handlers.js';

import { persistenceMethods }   from './state/persistence.js';
import { normalizeMethods }     from './state/normalize.js';
import { viewMethods }          from './state/view.js';

import { virtualScrollMethods } from './virtualization/virtual-scroll.js';

import { shellMethods }         from './rendering/shell.js';
import { gridMethods }          from './rendering/grid.js';
import { bodyMethods }          from './rendering/body.js';
import { cellMethods }          from './rendering/cell.js';
import { selectionUiMethods }   from './rendering/selection-ui.js';

import { inlineEditorMethods }  from './editing/inline-editor.js';
import { clipboardMethods }     from './editing/clipboard.js';

import { mouseMethods }         from './interaction/mouse.js';
import { keyboardMethods }      from './interaction/keyboard.js';
import { fillHandleMethods }    from './interaction/fill-handle.js';
import { columnDragMethods }    from './interaction/column-drag.js';
import { globalWiringMethods }  from './interaction/global-wiring.js';

import { toastMethods }         from './ui/toasts.js';
import { conflictModalMethods } from './ui/conflict-modal.js';
import { contextMenuMethods }   from './ui/context-menu.js';
import { filterPopoverMethods } from './ui/filter-popover.js';
import { columnsPopoverMethods }from './ui/columns-popover.js';

import { rowActionMethods }     from './actions/row-actions.js';
import { columnActionMethods }  from './actions/column-actions.js';
import { sortingMethods }       from './actions/sorting.js';
import { selectionMethods }     from './actions/selection.js';

// ─── SheetGrid Class ────────────────────────────────────────────────────────
export class SheetGrid extends HTMLElement {
  static get observedAttributes() {
    return ["storage-key", "readonly", "api-base", "client-id", "user-id"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    this._mounted = false;

    this.state = {
      columns: deepClone(DEFAULT_COLS),
      rows: [],
      sorts: [],
      filters: {},
      search: "",

      selection: { r1: 0, c1: 0, r2: 0, c2: 0 },
      active: { r: 0, c: 0 },
      editing: null,

      columnOrder: [],
      rowOrder: [],
      colHidden: {},
      colWidths: {},
      colLastWidth: {},
      rowHidden: {},
      rowHeights: {},
    };

    this.config = { ...DEFAULT_CONFIG };

    this._readOnly = false;

    // UI persistence debounce
    this._persistUiDebounced = debounce(() => this._persistUi(), this.config.autosaveUiMs);

    // Dirty/pending server updates
    this._pending = new Map();
    this._flushDebounced = debounce(() => this._flushPending().catch(console.error), this.config.serverFlushDebounceMs);
    this._flushInflight = false;

    // Conflicts
    this._conflicts = new Map();

    // Edit lock-acquire guard (prevents parallel _startEdit calls)
    this._startEditInFlight = false;

    // Live locks
    this._locks = new Map();
    this._ownedLock = null;
    this._rowVer = new Map();

    // Remote typing state
    this._remoteTyping = new Map();
    this._broadcastTypingDebounced = debounce((rowId, colId, value) => this._broadcastTyping(rowId, colId, value), 150);

    // Per-cell timers that fire when a remote typing-clear arrives and gridPatch
    // hasn't followed within the window. The timer fetches the authoritative DB
    // value so other users always see the saved result even if the SignalR
    // gridPatch broadcast is unreliable or arrives out of order.
    this._typingClearTimers = new Map();

    // Virtualization row meta
    this._rowMeta = { offsets: [], heights: [], total: 0, version: 0 };
    this._virt = { start: 0, end: -1, lastScrollTop: 0 };

    // Mouse state
    this._mouse = { selecting: false, didDragSelection: false, resizingCol: null, resizingRow: null };
    this._fill = null;
    this._colDrag = null;

    // View
    this._view = { viewRowIds: [], viewColIds: [] };

    // Fast O(1) row/col lookups — maintained alongside state.rows / state.columns
    this._rowMap = new Map();
    this._colMap = new Map(this.state.columns.map(c => [c.id, c]));

    // Tracks whether typing was broadcast for current cell (to optimise commit delay)
    this._lastBroadcastKey = null;

    // SignalR
    this._hub = null;
    this._liveConnected = false;
  }

  // ─── Attributes / config ──────────────────────────────────────────────────
  get storageKey() { return this.getAttribute("storage-key") || "auditor-grid-ui"; }
  get readOnly()   { return this._readOnly || this.hasAttribute("readonly"); }
  get apiBase()    { return (this.getAttribute("api-base") || "").replace(/\/+$/, ""); }
  get clientId()   { return Number(this.getAttribute("client-id") || 1); }
  get userId()     { return (this.getAttribute("user-id") || "anonymous@web").trim(); }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === "readonly") {
      this._readOnly = newVal !== null;
      if (this._mounted) this._renderGrid({ full: false });
    }

    if (["api-base", "client-id", "user-id"].includes(name) && oldVal !== newVal) {
      if (this._mounted) {
        this._disconnectLive();
        this._boot().catch(console.error);
      }
    }

    if (name === "storage-key" && oldVal !== newVal) {
      if (this._mounted) {
        this._loadUi();
        this._recomputeView();
        this._computeRowMeta();
        this._renderGrid({ full: true });
      }
    }
  }

  connectedCallback() {
    this._renderShell();
    this._mounted = true;
    this._boot().catch(console.error);
    this._wireGlobal();
  }

  disconnectedCallback() {
    this._startEditInFlight = false; // cancel any in-flight lock acquire
    if (this.state.editing) {
      const { rowId, colId } = this.state.editing;
      this._broadcastTyping(rowId, colId, "").catch(() => {});
    }
    this._releaseOwnedLock().catch(() => {});
    this._disconnectLive();
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────
  async _boot() {
    this._setStatus("Loading…");
    this._loadUi();


    await this._loadRowsFromServer();
    this._normalizeState();
    this._recomputeView();
    this._computeRowMeta();
    this._renderGrid({ full: true });

    await this._connectLive();
  }

  // ─── Basic helpers ────────────────────────────────────────────────────────
  _setStatus(msg) {
    const el = this.shadowRoot.querySelector("[data-status]");
    if (el) el.textContent = msg;
  }

  _toast(message, meta = {}) {
    this.dispatchEvent(new CustomEvent("toast", { detail: { message, ...meta } }));
    this._showToast(message, meta);
  }

  _colById(colId) { return this._colMap.get(colId); }
  _syncRowMap() { this._rowMap.clear(); for (const r of this.state.rows) this._rowMap.set(r.id, r); }
  _canEditCol(col) { return !!col && !this.readOnly && !col.readOnly; }
}

// ─── Assign all method modules to prototype ─────────────────────────────────
Object.assign(
  SheetGrid.prototype,

  // API
  apiClientMethods,
  rowsApiMethods,
  cellsApiMethods,
  locksApiMethods,
  typingApiMethods,

  // Live / SignalR
  connectionMethods,
  liveHandlerMethods,

  // State
  persistenceMethods,
  normalizeMethods,
  viewMethods,

  // Virtualization
  virtualScrollMethods,

  // Rendering
  shellMethods,
  gridMethods,
  bodyMethods,
  cellMethods,
  selectionUiMethods,

  // Editing
  inlineEditorMethods,
  clipboardMethods,

  // Interaction
  mouseMethods,
  keyboardMethods,
  fillHandleMethods,
  columnDragMethods,
  globalWiringMethods,

  // UI
  toastMethods,
  conflictModalMethods,
  contextMenuMethods,
  filterPopoverMethods,
  columnsPopoverMethods,

  // Actions
  rowActionMethods,
  columnActionMethods,
  sortingMethods,
  selectionMethods,
);

// ─── Register custom element ────────────────────────────────────────────────
if (!customElements.get("sheet-grid")) {
  customElements.define("sheet-grid", SheetGrid);
}
