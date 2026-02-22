# Grid Component – Module Map

> **Purpose:** Help engineers and AI assistants quickly navigate the grid component codebase for debugging, feature work, and code review.  
> **Audience:** Developers and AI tools triaging issues or making targeted edits.

---

## ⚠️ Current Path Reality

| Status | Detail |
|--------|--------|
| **Canonical location** | Repository root — `index.html`, `sheet-grid.js`, `src/` |
| **Monorepo scaffold** | `packages/sheet-grid/` — directory reserved for a future move; currently empty or not yet created |
| **This repo right now** | The repository is in an early/empty scaffold state. The grid source files listed below represent the **intended architecture**. Verify each path exists before editing. |

---

## Entry Points

| File | Role |
|------|------|
| `index.html` | Dev harness / demo host. Loads the grid and wires up host integration. Start here to understand how the grid is embedded. |
| `sheet-grid.js` | Public bundle / main entry. Exports the custom element and public API surface. **Read this before touching the API.** |
| `src/component.js` | Custom-element class definition. Registers `<sheet-grid>`, wires lifecycle hooks, delegates to sub-modules. |

---

## Folder-by-Folder Map

### `src/api/`
| Item | Detail |
|------|--------|
| **Role** | Public API surface exposed to host applications. All methods, properties, and events that cross the grid/host boundary live here. |
| **Key files** | `index.js` (barrel), method handlers, event dispatchers |
| **Common changes** | Adding new host-callable methods, changing event schemas, version-bumping the API contract |
| **Risk** | ⚠️ **High.** Breaking changes here affect every host integration. Always bump docs and notify consumers. |

---

### `src/live/`
| Item | Detail |
|------|--------|
| **Role** | Real-time / collaborative features: WebSocket or SSE listeners, presence updates, remote cursor rendering, conflict resolution. |
| **Key files** | `live-session.js`, `presence.js`, `sync.js` (verify names) |
| **Common changes** | Debugging dropped updates, adding new payload fields, reconnect logic |
| **Risk** | ⚠️ **High.** Race conditions between local edits and remote updates are subtle. Test with simulated latency. |

---

### `src/state/`
| Item | Detail |
|------|--------|
| **Role** | Single source of truth for grid data: cell values, column/row metadata, selection state, undo/redo stack. |
| **Key files** | `store.js`, `cell-state.js`, `selection.js` |
| **Common changes** | Adding new state slices, fixing stale-state bugs, undo/redo edge cases |
| **Risk** | ⚠️ **High.** Most bugs trace back here. Mutations that skip the state layer cause hard-to-reproduce inconsistencies. |

---

### `src/rendering/`
| Item | Detail |
|------|--------|
| **Role** | Canvas / DOM rendering pipeline. Paints cells, borders, headers, selection highlights, frozen panes. |
| **Key files** | `renderer.js`, `cell-painter.js`, `header-painter.js` |
| **Common changes** | Pixel-alignment fixes, new cell types, theme/colour changes |
| **Risk** | 🟡 **Medium.** Performance-sensitive. Avoid layout thrash inside paint loops. |

---

### `src/editing/`
| Item | Detail |
|------|--------|
| **Role** | In-cell editor lifecycle: open, commit, cancel, type detection (text, number, date, formula). |
| **Key files** | `editor.js`, `editor-types/`, `formula-bar.js` |
| **Common changes** | Supporting new input types, fixing IME/special-char bugs, formula-bar sync |
| **Risk** | 🟡 **Medium.** Tight coupling with `src/state/` and `src/interaction/`. |

---

### `src/interaction/`
| Item | Detail |
|------|--------|
| **Role** | Keyboard and pointer event handling: click, drag-select, keyboard navigation, copy/paste, context-menu. |
| **Key files** | `keyboard.js`, `pointer.js`, `clipboard.js`, `context-menu.js` |
| **Common changes** | New keyboard shortcuts, right-click menu items, touch-support improvements |
| **Risk** | 🟡 **Medium.** Event delegation order matters; easy to create double-handler bugs. |

---

### `src/virtualization/`
| Item | Detail |
|------|--------|
| **Role** | Row/column virtual scrolling. Only renders the visible viewport; manages offsets and recycled DOM/canvas rows. |
| **Key files** | `virtual-scroller.js`, `row-recycler.js`, `viewport.js` |
| **Common changes** | Fixing scroll-jump bugs, variable row-height support, frozen-row edge cases |
| **Risk** | ⚠️ **High.** Off-by-one errors in viewport math cause misaligned rows/columns and are hard to spot visually. |

---

### `src/ui/`
| Item | Detail |
|------|--------|
| **Role** | Overlay UI elements: lock overlays, dropdown pickers, tooltip, loading spinner, badges (e.g. typing indicator). |
| **Key files** | `lock-overlay.js`, `tooltip.js`, `badge.js` |
| **Common changes** | Lock/unlock visual states, badge text, z-index layering |
| **Risk** | 🟢 **Low–Medium.** Mostly cosmetic, but z-index and pointer-events mistakes block user interaction. |

---

### `src/actions/`
| Item | Detail |
|------|--------|
| **Role** | Discrete user-triggered operations (sort, filter, insert row, delete column, hide/show column, reorder). Each action is an atomic command, feeding the undo stack. |
| **Key files** | `sort.js`, `filter.js`, `column-actions.js`, `row-actions.js` |
| **Common changes** | New action types, fixing sort-stability bugs, filter-predicate logic |
| **Risk** | 🟡 **Medium.** Actions that mutate `src/state/` without going through defined reducers break undo/redo. |

---

### `src/config/`
| Item | Detail |
|------|--------|
| **Role** | Grid configuration schema and defaults (column definitions, frozen counts, feature flags, theme tokens). |
| **Key files** | `defaults.js`, `schema.js`, `feature-flags.js` |
| **Common changes** | New config options, changing defaults, adding validation rules |
| **Risk** | 🟢 **Low.** Changes here are safe if validation is updated alongside. |

---

### `src/utils/`
| Item | Detail |
|------|--------|
| **Role** | Pure utility functions shared across modules: coordinate math, DOM helpers, debounce/throttle, type guards. |
| **Key files** | `math.js`, `dom.js`, `throttle.js` |
| **Common changes** | Bug fixes in shared helpers (check call sites before changing signatures) |
| **Risk** | 🟡 **Medium.** Widely imported; a subtle change here can break multiple modules silently. |

---

### `src/styles/`
| Item | Detail |
|------|--------|
| **Role** | CSS / CSS-in-JS for component shadow DOM and any injected global styles. |
| **Key files** | `grid.css`, `themes/`, `tokens.js` |
| **Common changes** | Theming, dark-mode, custom scroll-bar styles |
| **Risk** | 🟢 **Low.** Mostly additive. Watch for specificity leaks into host page. |

---

## Quick AI Navigation Routes

Use these "read-first" paths to triage common issues without reading the whole codebase.

### 🔴 Cannot edit cell
1. `src/interaction/pointer.js` → check click handler opens editor  
2. `src/editing/editor.js` → editor open/close lifecycle  
3. `src/state/cell-state.js` → cell lock flag / read-only flag  
4. `src/ui/lock-overlay.js` → overlay blocking pointer events?

### 🔴 Live updates not showing
1. `src/live/sync.js` → WebSocket/SSE message handler  
2. `src/live/live-session.js` → connection state  
3. `src/state/store.js` → incoming delta applied to state?  
4. `src/rendering/renderer.js` → dirty-region invalidation triggered?

### 🔴 Lock visual / release issue
1. `src/ui/lock-overlay.js` → overlay shown/hidden  
2. `src/state/cell-state.js` → lock flag toggled correctly  
3. `src/live/presence.js` → remote lock released on disconnect?

### 🔴 Typing badge issue
1. `src/ui/badge.js` → badge render / content  
2. `src/live/presence.js` → presence payload: `isTyping` field  
3. `src/rendering/renderer.js` → badge positioned over correct cell?

### 🔴 Sorting / filter weirdness
1. `src/actions/sort.js` → sort comparator, stability  
2. `src/actions/filter.js` → predicate logic  
3. `src/state/store.js` → sorted/filtered row index applied?  
4. `src/rendering/renderer.js` → row order after sort matches state?

### 🔴 Column reorder / visibility issue
1. `src/actions/column-actions.js` → reorder / hide logic  
2. `src/state/store.js` → column order/visibility state  
3. `src/rendering/header-painter.js` → header reflects new order?  
4. `src/config/defaults.js` → initial column config

### 🔴 Selection border misalignment / row height issue
1. `src/virtualization/viewport.js` → row offset calculations  
2. `src/virtualization/virtual-scroller.js` → scroll offset  
3. `src/rendering/renderer.js` → selection rectangle coordinates  
4. `src/state/selection.js` → selected cell range

### 🔴 Public API / host integration changes
1. `sheet-grid.js` → exported API surface  
2. `src/api/index.js` → method implementations  
3. `src/component.js` → attribute/property reflection  
4. `index.html` → dev harness showing intended host usage

---

## Module Boundary Rules

| Rule | Detail |
|------|--------|
| **Grid core is self-contained** | All logic under `src/` must work without knowledge of the host application. No host-specific imports inside `src/`. |
| **API is the only bridge** | Host ↔ Grid communication must go through `src/api/` and the events defined there. |
| **Portal-specific logic stays outside** | Any logic that only makes sense for one specific host product belongs in that product's codebase, not in `src/`. |
| **Config, not code** | Customise grid behaviour through `src/config/` options; avoid forks of core modules for per-host needs. |

---

## Migration Note – Future Move to `packages/sheet-grid`

When the monorepo migration happens:

1. Copy/move `index.html`, `sheet-grid.js`, and `src/` into `packages/sheet-grid/`.
2. Update all import paths (currently relative from root).
3. Add a `package.json` with `"main": "sheet-grid.js"` and `"exports"` map.
4. Update CI to run builds from `packages/sheet-grid/`.
5. Update host integration import paths from bundle URL → `@workspace/sheet-grid`.
6. This `docs/grid/` directory can move to `packages/sheet-grid/docs/` or stay at repo root; keep one canonical location.

---

## Related Docs

| Document | Notes |
|----------|-------|
| `docs/grid/_code-verified-notes.md` | Code-verified implementation notes; highest-trust source for subtle behaviour. Create/update this file whenever a non-obvious behaviour is confirmed by reading source. |
| `README.md` | Top-level project overview |

---

*Last updated: 2026-02-22. Verify file names against actual repo structure before relying on this map—the codebase is in early scaffold state and file names may change.*
