# Sheet Grid — Module Map

> **Source of truth**: the file tree under `src/` and `sheet-grid.js`.
> Run a file-existence check against this map whenever modules are added,
> moved, or deleted.

---

## File tree

```
sheet-grid.js                    Entry point; registers <sheet-grid> custom element
index.html                       Demo page

src/
  component.js                   SheetGrid class (HTMLElement subclass)
  api/
    client.js                    ApiClient — fetch-based REST client
    endpoints.js                 Central path constants (ENDPOINTS object)
  live/
    hub.js                       GridHub — SignalR HubConnection wrapper
    handlers.js                  Pure functions: applyRowUpdated / RowLocked / RowUnlocked
  state/
    normalize.js                 normalizeRows() / normalizeColumns()
  editing/
    inline-editor.js             InlineEditor — contenteditable cell editor
  ui/
    conflict-modal.js            ConflictModal — <dialog>-based conflict resolution

docs/grid/
  _code-verified-notes.md        Verification log (what is code-verified vs. TBD)
  public-api.md                  Attributes, events, REST endpoints
  data-contracts.md              Canonical data shapes and field names
  collaboration-model.md         Lock flow, conflict flow, SignalR lifecycle
  module-map.md                  This file

services/auditor-grid-api/
  docs/
    signalr-events.md            Server → client SignalR event catalogue
```

---

## Dependency graph

```
index.html
  └─ sheet-grid.js
       └─ src/component.js
            ├─ src/api/client.js
            │    └─ (src/api/endpoints.js — constants, not a runtime import)
            ├─ src/live/hub.js
            │    └─ window.signalR  (external: @microsoft/signalr CDN)
            ├─ src/state/normalize.js
            ├─ src/editing/inline-editor.js
            └─ src/ui/conflict-modal.js

src/live/handlers.js             (standalone — used by tests; not imported by component.js)
```

> **Note**: `src/live/handlers.js` contains the pure-function equivalents of
> the SignalR handlers in `component.js`.  They share the same logic but are
> kept separate so they can be unit-tested without a DOM.
> Needs verification: decide whether to DRY these up by importing handlers.js
> from component.js.

---

## Module responsibilities

| File | Exports | Responsibility |
|------|---------|----------------|
| `sheet-grid.js` | — (side-effect) | Calls `customElements.define('sheet-grid', SheetGrid)` |
| `src/component.js` | `SheetGrid` | Orchestrates all sub-modules; owns Shadow DOM |
| `src/api/client.js` | `ApiClient` | HTTP fetch wrapper; adds `X-Client-Id` header |
| `src/api/endpoints.js` | `ENDPOINTS` | Path-building constants (not used at runtime by client.js) |
| `src/live/hub.js` | `GridHub` | SignalR connection lifecycle + event registration |
| `src/live/handlers.js` | `applyRowUpdated`, `applyRowLocked`, `applyRowUnlocked` | Pure row-mutation functions |
| `src/state/normalize.js` | `normalizeRows`, `normalizeColumns` | API alias resolution → canonical field names |
| `src/editing/inline-editor.js` | `InlineEditor` | Double-click-to-edit, Enter/Escape handling |
| `src/ui/conflict-modal.js` | `ConflictModal` | `<dialog>` diff UI; calls `onResolve` |

---

## Change checklist

When adding, moving, or deleting a source file:

- [ ] Update the File tree above
- [ ] Update the Dependency graph
- [ ] Update the Module responsibilities table
- [ ] Verify `sheet-grid.js` entry-point import chain still resolves
