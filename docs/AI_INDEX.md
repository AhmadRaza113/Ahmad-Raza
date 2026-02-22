# AI Index

This file is the routing guide for AI-assisted work in this repository.

It tells AI:
- what to read first,
- which docs/manifests/files are relevant for common task types,
- and what risks to watch for.

---

## Important Repo Path Rule (Current Reality)

**Canonical live code paths are currently at repo root** (not under `packages/sheet-grid` yet).

Use these as primary paths for all current code tasks:
- `index.html`
- `sheet-grid.js`
- `src/**`

The monorepo folders (`packages/`, `apps/`, `services/`) are currently scaffolds and mostly empty.

If/when code is moved, update manifests and this file.

---

## Default Context Loading Order (Always Start Here)

For any non-trivial task:

1. `docs/00-project-overview.md`
2. `docs/AI_INDEX.md`
3. `docs/manifests/module-index.json`
4. `docs/manifests/feature-to-files.json`
5. `docs/manifests/dependency-map.json`
6. Relevant area docs (grid / integration / backend / portal)
7. Impacted code files + immediate dependencies
8. Produce **Impact Summary**
9. Edit code
10. Validate
11. Update docs/manifests/changelog

---

## Common Task Categories and Routing

## 1) Grid bug fix — editing / selection / keyboard / mouse
### Read first
- `docs/grid/overview.md`
- `docs/grid/selection-editing-interaction-model.md`
- `docs/grid/module-map.md`
- `docs/grid/behavior-invariants.md` *(recommended file to add)*

### Read manifests
- `docs/manifests/feature-to-files.json`
- `docs/manifests/dependency-map.json`

### Common code areas (current paths)
- `src/editing/*`
- `src/interaction/*`
- `src/rendering/cell.js`
- `src/actions/selection.js`

### Common risks
- Editor/selection coupling regressions
- Mouse and keyboard behavior drift
- Re-render interrupting active edits
- Hidden dependency with typing/lock flows

---

## 2) Grid real-time collaboration bug — locks / typing / conflict / live sync
### Read first
- `docs/grid/collaboration-model.md`
- `docs/grid/data-contracts.md`
- `docs/grid/boot-sequence.md`
- `docs/grid/public-api.md`

### Read manifests
- `docs/manifests/feature-to-files.json`
- `docs/manifests/dependency-map.json`

### Common code areas (current paths)
- `src/api/locks-api.js`
- `src/api/typing-api.js`
- `src/api/cells-api.js`
- `src/live/connection.js`
- `src/live/handlers.js`
- `src/ui/conflict-modal.js`
- `src/rendering/cell.js`

### Common backend contracts to verify
- lock acquire/renew/release payloads
- typing payload format
- SignalR event names/payloads
- batch save conflict response shape

### Common risks
- Lock TTL renewal regression (current TTL ~30s, renew heartbeat ~12s)
- Debounce race affecting live propagation
- Local edits overwritten by inbound patch
- Conflict modal flow not triggered on stale `baseRowVer`
- Lock visuals out of sync with actual lock state

---

## 3) Grid rendering / virtualization / performance task
### Read first
- `docs/grid/rendering-and-virtualization.md`
- `docs/grid/module-map.md`
- `docs/grid/known-limitations.md`

### Common code areas (current paths)
- `src/virtualization/virtual-scroll.js`
- `src/rendering/*`
- `src/state/view.js`

### Common risks
- Row height measurement issues
- Selection overlay misalignment
- Off-by-one visible window bugs
- Performance regressions from unnecessary rerenders

---

## 4) Grid columns / sorting / filtering / preferences
### Read first
- `docs/grid/data-contracts.md`
- `docs/grid/state-persistence.md`
- `docs/grid/module-map.md`

### Common code areas (current paths)
- `src/config/columns.js`
- `src/config/defaults.js`
- `src/actions/sorting.js`
- `src/ui/filter-popover.js`
- `src/ui/columns-popover.js`
- `src/state/view.js`
- `src/state/persistence.js`

### Common risks
- Persisted UI schema compatibility
- Hidden sort columns (e.g. `seqNum`) accidentally broken
- Filter model mismatch with rendered state
- localStorage key/client scoping issues

---

## 5) `<sheet-grid>` public API or host integration change
### Read first (mandatory order)
1. `docs/grid/public-api.md`
2. `docs/integration/grid-portal-contract.md`
3. `docs/grid/data-contracts.md`
4. `docs/grid/boot-sequence.md`

### Common code areas (current paths)
- `index.html` (host test harness usage)
- `sheet-grid.js`
- `src/component.js`
- `src/rendering/shell.js`
- `src/live/connection.js`

### Current public surface (known)
- Attributes: `api-base`, `client-id`, `user-id`, `storage-key`, `readonly`
- Events: `live`, `toast`

### Common risks
- Breaking runtime attribute change behavior (disconnect/reboot)
- Host page assumptions on `live` / `toast`
- Public surface drift without doc updates

---

## 6) Backend contract update (Azure Functions / SignalR / Redis / SQL)
### Read first
- `docs/grid/data-contracts.md`
- `docs/grid/collaboration-model.md`
- `docs/grid/public-api.md`
- `services/auditor-grid-api/docs/*` *(if filled)*

### Common code areas (current paths)
- `src/api/*`
- `src/live/*`

### Current backend endpoints (known)
- `/api/auditorRequests`
- `/api/auditorRequests/batch`
- `/api/auditorRequests/rows`
- `/api/auditorRequests/rows/delete`
- `/api/locks/acquire|renew|release`
- `/api/typing`
- `/api/negotiate`

### Current SignalR events (known)
- `gridPatch`
- `gridRowAdded`
- `gridRowsDeleted`
- `gridLockChanged`
- `gridTyping`

### Common risks
- Payload shape mismatch between Functions and client normalizer
- `rowVer` handling mismatch
- Lock holder object drift
- Event payload changes not reflected in UI handlers

---

## 7) Grid ↔ Portal integration contract work (planned, boundary-sensitive)
### Read first (mandatory order)
1. `docs/integration/grid-portal-contract.md`
2. `docs/grid/public-api.md`
3. `docs/grid/data-contracts.md`
4. `docs/portal/overview.md` *(when written)*

### Common risks
- Portal business logic leaking into grid core
- Grid becoming tied to Auditor domain assumptions
- Contract docs written before as-built public API is verified
- Referencing scaffold paths as if they are live

---

## 8) Documentation sync only (no code changes)
### Read first
- `docs/00-project-overview.md`
- `docs/AI_INDEX.md`
- Relevant module docs
- Relevant manifests

### Common risks
- Documenting assumptions as facts
- Forgetting current-vs-planned path distinction
- Leaving manifests inconsistent with file paths

---

## Required Output Before Editing: Impact Summary

Before editing code, AI should produce an **Impact Summary** containing:

- Task understanding
- Scope / out-of-scope
- Impacted docs
- Impacted files
- Risks / likely regressions
- Validation plan (manual steps and/or tests)
- Implementation order

---

## Documentation Update Order (After Code Changes)

When behavior/contracts change, update docs in this order:

1. `docs/grid/public-api.md` and/or `docs/integration/grid-portal-contract.md` (if boundary/public surface changed)
2. Relevant module docs (`docs/grid/*`, `docs/portal/*`, backend docs)
3. Manifests (`feature-to-files`, `dependency-map`, `docs-index`)
4. `CHANGELOG.md`
5. `docs/00-project-overview.md` (only if big-picture changed)

---

## Style Rules for AI Edits in This Repo

- Prefer small safe edits over broad refactors
- Use **root paths** for current code tasks
- Do not invent backend contracts — mark unknowns as **Needs verification**
- Preserve boundary:
  - Grid = interaction/render/collaboration engine
  - Portal = business workflows/host UI
- If behavior changes, docs must change in same task

---

## Useful Keywords → Likely Areas

- **api-base / client-id / user-id / readonly** → `src/component.js`, `sheet-grid.js`, `docs/grid/public-api.md`
- **live event / toast event** → `src/live/connection.js`, `src/ui/toasts.js`, public API docs
- **lock / ttl / renew / holder** → `src/api/locks-api.js`, `src/live/handlers.js`, `src/rendering/cell.js`
- **typing preview / gridTyping** → `src/api/typing-api.js`, `src/live/handlers.js`, `src/rendering/cell.js`
- **rowVer / conflict / Keep Mine / Accept Server** → `src/api/cells-api.js`, `src/ui/conflict-modal.js`
- **gridPatch / gridRowAdded / gridRowsDeleted** → `src/live/handlers.js`, `src/state/normalize.js`, `src/state/view.js`
- **seqNum / default sort** → `src/actions/sorting.js`, `src/config/defaults.js`, `src/state/view.js`
- **virtual scroll / row heights** → `src/virtualization/virtual-scroll.js`, `src/rendering/body.js`, `src/rendering/selection-ui.js`
- **storage-key / localStorage prefs** → `src/state/persistence.js`, `docs/grid/state-persistence.md`

---

## TODO / Verification Backlog

- Finalize `docs/grid/public-api.md` with verified attribute observation list and runtime behavior
- Finalize `docs/grid/data-contracts.md` with exact payload examples from code
- Finalize `docs/grid/collaboration-model.md` with SignalR event handling flow
- Add `docs/grid/behavior-invariants.md`
- Fill `services/auditor-grid-api/docs/*` with verified backend as-built contracts
- Update this index after code moves from root to `packages/sheet-grid`