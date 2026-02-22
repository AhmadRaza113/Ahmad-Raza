# Code-Verified Notes — `<sheet-grid>` Component

> **Purpose:** Internal working doc. Facts extracted from actual source code.
> **Date:** 2026-02-22
> **Source files inspected:** `index.html`, `sheet-grid.js`, `src/component.js`,
> `src/api/*`, `src/live/*`, `src/state/*`, `src/rendering/cell.js`,
> `src/editing/inline-editor.js`, `src/ui/conflict-modal.js`,
> `src/config/columns.js`, `src/config/defaults.js`, `src/interaction/*`,
> `src/virtualization/virtual-scroll.js`, `src/utils/format.js`

---

## 1. Repo Path Reality

### Root code paths (active source)
- `index.html` — standalone host page, loads the component via `import("./sheet-grid.js")`
- `sheet-grid.js` — barrel: `export { SheetGrid } from './src/component.js'`
- `src/component.js` — defines the `SheetGrid` class, imports all method modules, registers `<sheet-grid>` custom element
- `src/api/` — HTTP fetch wrappers (client, rows, cells/batch, locks, typing)
- `src/live/` — SignalR connection + event handlers
- `src/state/` — normalize, persistence (localStorage), view recomputation
- `src/rendering/` — shell, grid, body, cell, selection-ui
- `src/editing/` — inline-editor, clipboard
- `src/interaction/` — mouse, keyboard, fill-handle, column-drag, global-wiring
- `src/ui/` — toasts, conflict-modal, context-menu, filter-popover, columns-popover
- `src/actions/` — row-actions, column-actions, sorting, selection
- `src/config/` — columns (DEFAULT_COLS), defaults (DEFAULT_CONFIG, PERSIST_VERSION)
- `src/utils/` — helpers, dom, format, datetime, tsv
- `src/virtualization/` — virtual-scroll
- `src/styles/` — grid-styles.js

### Other repo paths (NOT inspected in depth here)
- `packages/sheet-grid/` — appears to be an alternate/published copy (has its own `index.html`, `sheet-grid.js`, `src/`, `test-harness/`)
- `apps/portal/` — separate portal app (not grid source)
- `services/auditor-grid-api/` — backend API service; has docs but no Azure Function source code visible in repo
- `scripts/` — verification scripts
- `docs/` — documentation tree

---

## 2. `<sheet-grid>` Public API Facts

### Observed attributes (`static get observedAttributes()`)
```
"storage-key", "readonly", "api-base", "client-id", "user-id"
```

### Attribute change behavior (`attributeChangedCallback`)
| Attribute | Behavior on change |
|---|---|
| `readonly` | Sets `this._readOnly`; re-renders grid if mounted |
| `api-base`, `client-id`, `user-id` | If mounted: disconnects live, re-runs `_boot()` (full reload + reconnect) |
| `storage-key` | If mounted: reloads UI prefs from localStorage, recomputes view, full re-render |

### Host initialization pattern (from `index.html`)
1. Query params parsed: `?client=<N>&user=<email>&api=<root>`
2. Attributes set on `<sheet-grid id="grid">` **before** the module import:
   - `api-base` — Azure Function App root URL (NOT `/api`; code auto-strips trailing `/api`)
   - `client-id` — numeric (default `1`)
   - `user-id` — string, persisted in `localStorage("auditorGridUserId")`; fallback generates random `userNNNN@web`
   - `storage-key` — pattern: `"auditor-grid-ui-client-${clientId}"`
3. SignalR client loaded from CDN (jsdelivr, then unpkg fallback) **before** component import
4. Component imported via `await import("./sheet-grid.js")`

### Custom events emitted

| Event name | `detail` shape | Where dispatched |
|---|---|---|
| `"live"` | `{ connected: boolean }` | `_setLive()` in `connection.js` — fires on connect, reconnect, disconnect |
| `"toast"` | `{ message: string, ...meta }` where meta can include `kind: "ok"|"warn"|"error"`, `detail: string` | `_toast()` in `component.js` |

### Public methods
- None exposed. All methods are prefixed with `_` (private convention). The component is driven entirely by attributes + internal boot.

### Lifecycle
- `connectedCallback`: renders shell → calls `_boot()` (async) → wires global events
- `_boot()`: sets status → loads UI from localStorage → fetches rows from server → normalizes state → recomputes view → computes row meta → renders grid → connects SignalR
- `disconnectedCallback`: cancels editing lock, broadcasts typing clear, releases owned lock, disconnects live

---

## 3. API Endpoint Paths (Frontend-Observed Contract)

All paths are relative to `this.apiBase` (the Function App root). The code prepends `this.apiBase` + path.

### 3.1 Load rows
- **Path:** `GET /api/auditorRequests?clientId={clientId}`
- **Optional param:** `&rowId={rowId}` (single-row fetch fallback)
- **Expected response:** `{ ok: boolean, rows: Array<Row>, error?: string }`
- **Row shape from server:**
  ```
  { id, clientId, rowVer, updatedAt, updatedBy, values: { ... }, reqNo?, seqNum? }
  ```
- **Frontend mapping:** `reqNo` → `values.req_no`, `seqNum` → `values.seqNum` (top-level → nested)

### 3.2 Batch cell save
- **Path:** `POST /api/auditorRequests/batch`
- **Request body:**
  ```json
  {
    "clientId": <number>,
    "byUser": "<userId>",
    "updates": [
      { "rowId": "<id>", "colId": "<colId>", "value": <any>, "baseRowVer": <number|null> }
    ]
  }
  ```
- **`updates` constraint:** at most one update per `rowId` per call; max `serverFlushBatchMax` (40) items
- **Expected response:**
  ```json
  {
    "ok": true,
    "results": [
      {
        "rowId": "<id>",
        "colId": "<colId>",
        "updated": true,
        "value": <any>,
        "rowVer": <number>,
        "updatedAt": "<ISO>",
        "updatedBy": "<userId>"
      }
    ]
  }
  ```
- **Conflict result variant:**
  ```json
  {
    "rowId": "<id>",
    "colId": "<colId>",
    "conflict": true,
    "currentValue": <any>,
    "currentUpdatedAt": "<ISO>",
    "currentUpdatedBy": "<userId>",
    "currentRowVer": <number>
  }
  ```

### 3.3 Add row
- **Path:** `POST /api/auditorRequests/rows`
- **Request body:**
  ```json
  { "clientId": <number>, "byUser": "<userId>", "values": {} }
  ```
- **Expected response:** `{ ok: boolean, row: Row, error?: string }`

### 3.4 Delete rows
- **Path:** `POST /api/auditorRequests/rows/delete`
- **Request body:**
  ```json
  { "clientId": <number>, "byUser": "<userId>", "rowIds": ["<id>", ...] }
  ```
- **Expected response:** `{ ok: boolean, deleted: number, error?: string }`

### 3.5 Lock acquire
- **Path:** `POST /api/locks/acquire`
- **Request body:**
  ```json
  { "clientId": <number>, "rowId": "<id>", "colId": "<colId>", "userId": "<userId>", "ttlSeconds": 30 }
  ```
- **Expected response on success:** `{ acquired: true }`
- **Expected response on failure:** `{ acquired: false, holder: { userId, acquiredAtUtc?, ttlSeconds? } }`

### 3.6 Lock renew
- **Path:** `POST /api/locks/renew`
- **Request body:**
  ```json
  { "clientId": <number>, "rowId": "<id>", "colId": "<colId>", "userId": "<userId>", "ttlSeconds": 30 }
  ```
- **Expected response:** `{ renewed: boolean, holder?: ... }`

### 3.7 Lock release
- **Path:** `POST /api/locks/release`
- **Request body:**
  ```json
  { "clientId": <number>, "rowId": "<id>", "colId": "<colId>", "userId": "<userId>" }
  ```
- **Also sent via `navigator.sendBeacon` on `beforeunload`**

### 3.8 Typing broadcast
- **Path:** `POST /api/typing`
- **Request body:**
  ```json
  { "clientId": <number>, "rowId": "<id>", "colId": "<colId>", "userId": "<userId>", "value": "<string>" }
  ```
- **Value `""` means "stopped typing" (clear indicator)**
- **Also sent via `navigator.sendBeacon` on `beforeunload` (value: `""`)**

### 3.9 SignalR negotiate
- **Path:** `POST /api/negotiate?clientId={clientId}&userId={userId}`
- **Expected response:** `{ url: "<hubUrl>", accessToken: "<jwt>" }`

### Unknowns
- Backend Azure Function code is NOT in this repo — all above are **frontend-observed contracts**
- Exact DB schema not verifiable from frontend code
- Content-Type for sendBeacon body: code uses `new Blob([JSON.stringify(...)], { type: "application/json" })` for batch, but plain `JSON.stringify(...)` (no Blob) for lock release and typing clear on beforeunload — **`Needs verification`** whether server handles both

---

## 4. SignalR / Live Collaboration Facts

### Negotiate
- Path: `POST /api/negotiate?clientId={clientId}&userId={userId}`
- Returns `{ url, accessToken }` — used to construct `HubConnectionBuilder().withUrl(url, { accessTokenFactory })`

### Hub name
- **Not visible in frontend code**. The `url` returned by negotiate is used directly. Hub name is embedded in the negotiate response URL. `Needs verification` — likely an Azure SignalR Service managed hub.

### Reconnect policy
- `withAutomaticReconnect([0, 2000, 5000, 10000, 15000])` — 5 attempts with increasing delays
- On `onreconnected`: full reload from server (`_loadRowsFromServer` + normalize + recompute + render)
- On `onclose` / `onreconnecting`: sets live = false

### SignalR event names listened to

| Event name | Message fields used | Handler |
|---|---|---|
| `gridPatch` | `{ clientId, rowId, colId, value, rowVer, updatedAt, updatedBy }` | `_onGridPatch` |
| `gridRowAdded` | `{ clientId, row: { id, clientId, rowVer, updatedAt, updatedBy, values, reqNo? } }` | `_onGridRowAdded` |
| `gridRowsDeleted` | `{ clientId, rowIds: string[] }` | `_onGridRowsDeleted` |
| `gridLockChanged` | `{ clientId, rowId, colId, locked: boolean, holder: { userId, ... } }` | `_onGridLockChanged` |
| `gridTyping` | `{ clientId, rowId, colId, userId, value }` | `_onGridTyping` |

### Handler behavior summary

- **`gridPatch`**: Filters by `clientId`. Self-patches (`updatedBy === this.userId`) still applied to row data but skip re-render. For other users: if pending change exists for same cell, creates a conflict entry. If user is editing the same cell, does NOT overwrite the input. Clears remote typing preview and cancels any pending clear timer. Does targeted DOM update if currently editing another cell (avoids destroying editor).

- **`gridRowAdded`**: Skips if row ID already exists. Prepends row to `state.rows` and `rowOrder`. Maps `reqNo` → `values.req_no`. Full re-render.

- **`gridRowsDeleted`**: Removes rows from `state.rows`, `rowOrder`, and cleans pending/conflicts/locks maps. Full re-render.

- **`gridLockChanged`**: Updates `_locks` map. If locked by same user and currently editing that cell, skips re-render. If not, re-renders body.

- **`gridTyping`**: Ignores self-broadcasted events. On active typing (value non-empty): stores in `_remoteTyping`, does targeted DOM update if editing another cell. On typing cleared (value empty): starts a 450ms timer. If `gridPatch` arrives within that window, timer is cancelled. If timer fires, fetches row from DB via `GET /api/auditorRequests?clientId=...&rowId=...` to get committed value, then clears the typing preview.

---

## 5. Row / Data Shape and Normalization

### Row keys used by frontend
Frontend row objects after `_loadRowsFromServer`:
```
{ id, clientId, rowVer, updatedAt, updatedBy, values: { ... } }
```
- `id` — unique row identifier (type from server: string, used as map key)
- `clientId` — numeric
- `rowVer` — see below
- `updatedAt` — ISO datetime string from server
- `updatedBy` — userId string from server
- `values` — flat object with `colId → value` entries

### `rowVer` handling
- Stored in `this._rowVer` Map (`rowId → rowVer`)
- Sent as `baseRowVer` in batch save requests (for optimistic concurrency)
- Compared numerically: `Number(fresh.rowVer) <= Number(existing.rowVer)` in `_refreshSingleRow`
- **Type assumption in code: numeric** (compared with `Number()` coercion and `<=`)
- Code also handles `null` as initial value before first fetch

### `reqNo` / `seqNum` mapping
- Server returns `reqNo` and `seqNum` as **top-level** fields on row objects
- Frontend maps them into `values`: `reqNo` → `values.req_no`, `seqNum` → `values.seqNum`
- This mapping happens in `_loadRowsFromServer`, `_refreshSingleRow`, and `_onGridRowAdded`
- **Note:** `seqNum` mapped to `values.seqNum` (same key); `reqNo` mapped to `values.req_no` (underscore)

### `values` object usage
- Keys are column IDs from `DEFAULT_COLS` (e.g. `auditor_request`, `host_comments`, `status`, etc.)
- Plus synthetic keys: `req_no`, `seqNum`
- Values are strings, numbers, or null/undefined
- Default sort (when no user sorts): ascending by `values.seqNum` (numeric)
- `seqNum` is explicitly filtered out of persisted sorts: `ui.sorts.filter(s => s.colId !== "seqNum")`

---

## 6. Locks / Typing / Conflict Handling

### Lock timing (from `DEFAULT_CONFIG`)
- **TTL:** `lockTtlSeconds: 30` — sent to server in acquire/renew payloads
- **Renew interval:** `lockRenewEveryMs: 12000` (12 seconds)
- Renew runs via `setInterval`; checks if still editing the same cell before renewing

### Lock acquire flow
1. Editor shown optimistically (with `lockPending` CSS class)
2. `POST /api/locks/acquire` sent
3. If `acquired: true` → lock stored in `_locks` map, renew timer started
4. If `acquired: false` and holder is self → treat as own lock (recover)
5. If `acquired: false` and holder is other → editor rolled back, toast shown

### Lock renew behavior
- If renew returns `{ renewed: false }` → toast "lost lock", cancel edit, release
- Renew failures (network) silently ignored

### Lock release
- On commit (`_commitEdit`): `_releaseOwnedLock()` clears interval, calls `POST /api/locks/release`
- On cancel (`_cancelEdit`): same release
- On `disconnectedCallback`: attempted async release
- On `beforeunload`: `sendBeacon` to `/api/locks/release`

### Lock payloads
- **Acquire:** `{ clientId, rowId, colId, userId, ttlSeconds }`
- **Renew:** `{ clientId, rowId, colId, userId, ttlSeconds }`
- **Release:** `{ clientId, rowId, colId, userId }`

### Typing broadcast
- **Debounced at 150ms** (`_broadcastTypingDebounced`)
- Fires on every `input` event from inline editor (value = current input value)
- On commit: debounced call cancelled, then explicit clear (`value: ""`) sent after a 200ms delay (to let gridPatch arrive first)
- On cancel: debounced call cancelled, then explicit clear (`value: ""`) sent immediately
- `_lastBroadcastKey` tracks whether typing was broadcast for current cell

### Conflict detection / resolution
- **Detection occurs in two places:**
  1. **Batch save response:** server returns `{ conflict: true, currentValue, currentRowVer, ... }` — stored in `_conflicts` Map
  2. **`gridPatch` handler:** if `_pending` has an entry for the patched cell from another user, creates conflict entry
- **Conflict data shape:**
  ```
  { rowId, colId, mine, server, updatedAt, updatedBy, currentRowVer }
  ```
- **Modal flow (`conflict-modal.js`):**
  - Clicking a conflicted cell opens the modal (instead of editing)
  - Shows "Your value" vs "Server value"
  - Three actions:
    - "Keep mine (overwrite)" → sets `row.values[colId] = mine`, re-saves via `_saveCellToServer`, deletes conflict
    - "Accept server" → deletes conflict, re-renders (server value already in row)
    - "Close" → closes modal without resolving (conflict remains; cell stays red)
- **Conflict cells** get CSS class `"conflict"` on the `<td>`

---

## 7. Module Responsibilities (Rough Notes)

### `src/config/`
- **columns.js** — `DEFAULT_COLS` array: 12 columns with `id`, `name`, `type`, `readOnly`, `width`, optional `options`
  - Column types: `multiline`, `person`, `choice`, `datetime`, `text`, `number`
  - Some columns are `readOnly: true` (due_datetime, client_name, closed_time, completed_on, client_id)
- **defaults.js** — `DEFAULT_CONFIG` object + `PERSIST_VERSION` (currently 14)

### `src/api/`
- **client.js** — `_api(path, opts)`: generic fetch wrapper, JSON parse, error throw
- **rows-api.js** — `_loadRowsFromServer`, `_refreshSingleRow`, `_addRowServer`, `_deleteRowsServer`
- **cells-api.js** — `_saveCellToServer` (debounced queue), `_flushNow`, `_flushPending` (batch POST)
- **locks-api.js** — `_acquireLock`, `_renewLock`, `_releaseLock`, `_startLockRenew`, `_releaseOwnedLock`
- **typing-api.js** — `_broadcastTyping`, `_clearRemoteTyping`

### `src/live/`
- **connection.js** — `_connectLive`, `_disconnectLive`, `_setLive` (status pill + event dispatch)
- **handlers.js** — `_onGridPatch`, `_onGridRowAdded`, `_onGridRowsDeleted`, `_onGridLockChanged`, `_onGridTyping`

### `src/state/`
- **normalize.js** — `_normalizeState`: reconciles columnOrder/rowOrder with actual data, sets default widths, clamps selection
- **persistence.js** — `_persistUi` / `_loadUi`: save/restore to localStorage under `storageKey`
  - Persisted keys: `sorts`, `filters`, `search`, `columnOrder`, `colHidden`, `colWidths`, `colLastWidth`, `rowHidden`, `rowHeights`
  - Version-gated by `PERSIST_VERSION` (currently 14)
- **view.js** — `_recomputeView`: filters rows by search/column filters, applies multi-sort, default sort by `seqNum` asc

### `src/rendering/`
- **shell.js** — initial shadow DOM shell (not inspected in detail)
- **grid.js** — grid rendering orchestrator (not inspected in detail)
- **body.js** — row-level rendering (not inspected in detail)
- **cell.js** — `_renderCell`: generates `<td>` HTML with editor/lock/typing/conflict states
- **selection-ui.js** — selection class management (not inspected in detail)

### `src/editing/`
- **inline-editor.js** — `_wireInlineEditorIfAny`, `_startEdit`, `_commitEdit`, `_cancelEdit`, `_formatValue`
  - Editor types: `<input type="text">`, `<input type="datetime-local">`, `<input type="text" inputmode="decimal">` (number), `<select>` (choice/person), `<textarea>` (multiline)
  - Commit triggers: blur, Enter, Tab, Ctrl+Enter (multiline), click-other-cell, outside click
  - Save timing: `_flushNow` on commit (immediate), `_saveCellToServer` for other paths (debounced 800ms)
- **clipboard.js** — copy/cut/paste (not inspected in detail)

### `src/interaction/`
- **mouse.js** — cell selection via click/drag, column/row resize drag, fill handle start
- **keyboard.js** — arrow navigation, Tab, Enter/F2 to edit, Delete/Backspace to clear, character key to start-edit
- **fill-handle.js** — Excel-style drag-to-fill: source selection pattern repeats in target range
- **column-drag.js** — column reorder via pointer drag on header cells
- **global-wiring.js** — attaches all event listeners (scroll, mouse, keyboard, clipboard, popover dismiss, `beforeunload`)
  - `beforeunload` uses `sendBeacon` for pending batch save, lock release, and typing clear

### `src/virtualization/`
- **virtual-scroll.js** — `_computeRowMeta` (offset table), `_calcVirtRange` (visible rows + overscan), `_ensureCellVisible`
  - Overscan: 10 rows (configurable)
  - Row heights per-row (stored in `state.rowHeights`, default 34px)
  - Binary search for row-at-Y offset

### `src/ui/`
- **conflict-modal.js** — see section 6 above
- **toasts.js** — toast display (not inspected in detail)
- **context-menu.js** — right-click menu (not inspected in detail)
- **filter-popover.js** — per-column filter UI (not inspected in detail)
- **columns-popover.js** — show/hide columns UI (not inspected in detail)

### `src/utils/`
- **helpers.js** — `deepClone`, `debounce`, `clamp`, `isBlank`, `containsCI`, `startsCI`, `equalsCI`
- **dom.js** — `escapeHtml` and likely other DOM helpers
- **format.js** — `initialsFromUserId`, `displayNameFromUserId`, `valueKeyForFilter`, `formatValue`
- **datetime.js** — `toDatetimeLocalValue`, `normalizeDatetimeLocalValue`
- **tsv.js** — TSV parsing/generation for clipboard (not inspected in detail)

### `src/actions/`
- **row-actions.js** — add/delete row actions (not inspected in detail)
- **column-actions.js** — column show/hide/resize actions (not inspected in detail)
- **sorting.js** — sort toggle/management (not inspected in detail)
- **selection.js** — selection utilities (not inspected in detail)

### `src/styles/`
- **grid-styles.js** — CSS styles injected into shadow DOM (not inspected in detail)

### High-risk / complex files
- `src/live/handlers.js` — 315 lines; most complex state mutation logic; race conditions between typing-clear timers, gridPatch, and DB refetch
- `src/editing/inline-editor.js` — ~260 lines; editing lifecycle with lock acquire/release, typing broadcast, commit flow
- `src/api/cells-api.js` — batch flush with conflict handling; in-flight guard and retry logic
- `src/interaction/global-wiring.js` — `beforeunload` beacon logic; click-outside edit commit with composedPath through shadow DOM
- `src/state/view.js` — filter/sort logic with multi-mode filters (text, values, range, blanks)

---

## 8. Needs Verification

| Unknown | Likely source / notes |
|---|---|
| Hub name for Azure SignalR Service | Not in frontend code; embedded in negotiate response URL. Check `services/auditor-grid-api/` or Azure portal. |
| Exact DB schema (table names, column types, indexes) | No backend source in repo. Frontend-observed only. |
| Server-side lock storage mechanism (Redis confirmed in comment only) | `component.js` header comment says "Redis locks" but no backend code to verify. |
| `sendBeacon` content-type handling for lock release / typing clear | Code sends `JSON.stringify(...)` as plain string (not Blob). Server may or may not parse correctly — no backend code to verify. |
| `reqNo` generation logic (auto-increment? per-client?) | Frontend treats as read-only display. Generated server-side. |
| `seqNum` generation logic | Frontend uses for default sort order. Generated server-side. |
| `rowVer` semantics (SQL rowversion? integer counter?) | Frontend treats as numeric via `Number()` coercion; never increments client-side. |
| Whether `GET /api/auditorRequests?rowId=...` actually filters server-side | `_refreshSingleRow` sends `rowId` param, but comment says "if the server supports it; otherwise iterates the full rows response". |
| Exact error response shape from server | Frontend reads `json?.error` but does not enforce shape. |
| Lock cleanup on server disconnect (TTL expiry vs active cleanup) | Comment mentions "disconnect cleanup" but mechanism is server-side. |
| `gridRowAdded` message: does server include `seqNum` in the row? | `_onGridRowAdded` handler does NOT map `seqNum` (only maps `reqNo`). Possible oversight or server always nests it in `values`. |
| Exact CSS for `lockPending`, `conflict`, `remoteTyping`, `lockedByOther` classes | Defined in `src/styles/grid-styles.js` — not inspected. |
| Filter modes implementation details (values list generation, popover UX) | `src/ui/filter-popover.js` not inspected. View.js shows 4 modes: `text`, `values`, `range`, `blanks`. |
| Context menu actions | `src/ui/context-menu.js` not inspected. |
| Clipboard TSV format details | `src/editing/clipboard.js` and `src/utils/tsv.js` not inspected. |
| Row action menu / add-delete UI flow | `src/actions/row-actions.js` not inspected. |
| Shell rendering HTML structure | `src/rendering/shell.js` not inspected. |
