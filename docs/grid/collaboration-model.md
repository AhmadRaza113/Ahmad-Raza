# Grid Collaboration Model

## Purpose

This document describes the real-time collaborative behavior of the grid component: how concurrent users acquire cell locks, broadcast typing previews, save changes, receive live patches from other users, and resolve edit conflicts.

---

## Scope

- Frontend modules that handle real-time collaboration (`src/live/`, `src/api/`, `src/editing/`, `src/rendering/`, `src/ui/`)
- The SignalR hub events consumed by the frontend
- The locking, typing-preview, save, and conflict flows as observed in code
- Known race-condition-sensitive areas and reconnect behavior

> **Note:** At the time this document was written, the source files listed under "Must inspect" were not present in the repository. All behavioral details below are marked **Needs verification** until the corresponding source code is reviewed. Once those files are available, this document should be updated using the source-of-truth priority order:
> 1. Actual code in repo
> 2. `docs/grid/_code-verified-notes.md`
> 3. Existing docs (only if code-aligned)
> 4. Unknowns → _Needs verification_

---

## Current Collaboration Summary (As-Built Behavior)

> **Needs verification** — no source files were present at authoring time. The summary below reflects the intended design implied by the module names and event names listed in the problem statement and should be validated against the actual implementation.

Multiple users can edit the same grid simultaneously. Before editing a cell, the frontend acquires a server-side lock for that cell. While the lock is held, keystrokes are broadcast to other connected clients as transient typing previews. When the user commits the edit, the change is saved with an optimistic version token (`rowVer`). The server applies the change and broadcasts a live patch to all subscribers. If another client saved the same row between lock acquisition and save, the server rejects the save and the frontend shows a conflict modal.

---

## Collaboration Components

| Layer | Module / Service | Role |
|-------|-----------------|------|
| Frontend – live transport | `src/live/connection.js` | Opens/manages the SignalR connection |
| Frontend – live events | `src/live/handlers.js` | Registers SignalR event handlers and dispatches updates |
| Frontend – lock API | `src/api/locks-api.js` | Acquire, renew, and release cell locks |
| Frontend – typing API | `src/api/typing-api.js` | Broadcast typing previews |
| Frontend – cells API | `src/api/cells-api.js` | Save cell values (triggers live patch on success) |
| Frontend – inline editor | `src/editing/inline-editor.js` | Coordinates lock lifecycle with the editing session |
| Frontend – cell renderer | `src/rendering/cell.js` | Renders lock indicators and typing previews |
| Frontend – conflict modal | `src/ui/conflict-modal.js` | Presents conflict resolution choices to the user |
| Frontend – toasts | `src/ui/toasts.js` | _(Optional)_ Displays connection-state or conflict notifications |
| Frontend – component root | `src/component.js` | Wires live events to grid state; exposes public `live` event API |
| Backend | SignalR hub | Routes `gridPatch`, `gridLockChanged`, `gridTyping`, and related events to group members |

> All module paths and responsibilities are **Needs verification**.

---

## Core Concepts

### Cell Lock

A cell lock is a server-side reservation that grants one user exclusive write access to a specific cell. The lock is identified by a composite key and carries a TTL. While locked, other clients see a visual indicator on that cell and cannot start editing it.

> Lock identity key structure, TTL value, and visual indicator details are **Needs verification** (see `src/api/locks-api.js`, `src/rendering/cell.js`).

### Typing Preview

While a lock is held and the user is typing, each keystroke (or debounced batch of keystrokes) is broadcast to other connected clients as a _transient_ preview. Typing previews are not persisted; they disappear when the edit session ends or the connection drops.

> Debounce interval and broadcast frequency are **Needs verification** (see `src/api/typing-api.js`, `src/live/handlers.js`).

### Live Patch

When a cell value is successfully saved, the backend broadcasts a _live patch_ event (`gridPatch`) to all other clients subscribed to the same grid. A live patch contains the authoritative new value and the updated `rowVer` token. Receiving clients apply the patch to their local grid state without a full reload.

> Patch payload schema and client-side merge strategy are **Needs verification** (see `src/live/handlers.js`, `src/rendering/cell.js`).

### Conflict

A conflict occurs when two users attempt to save the same row and the second save arrives after the first has already incremented `rowVer`. The server rejects the stale save (HTTP 409 or equivalent) and the client shows a conflict modal offering the user a resolution choice (e.g., overwrite with their value, or discard and accept the remote value).

> HTTP status code used for conflict, exact resolution options, and modal trigger path are **Needs verification** (see `src/api/cells-api.js`, `src/ui/conflict-modal.js`).

---

## End-to-End Edit Flow (Happy Path)

```
User            Frontend                      SignalR / Backend
 |                |                                  |
 |-- click cell ->|                                  |
 |                |--- acquire lock ---------------->|
 |                |<-- lock granted (lockId, TTL) ---|
 |                |                                  |
 |-- type char -->|--- broadcast typing preview ---->|
 |                |           (gridTyping)           |-- fans out to peers -->
 |                |                                  |
 |                |--- renew lock (before TTL) ----->|   (if renew is present)
 |                |<-- lock renewed -----------------|
 |                |                                  |
 |-- commit ----->|--- save cell (rowVer) ---------->|
 |                |<-- 200 OK (new rowVer) ----------|
 |                |                                  |-- gridPatch to peers -->
 |                |--- release lock ---------------->|
 |                |<-- lock released ----------------|
```

> Step ordering and exact API signatures are **Needs verification**.

### Steps

1. **Acquire lock** — `src/api/locks-api.js` sends a lock-acquire request for the target cell. On success the frontend receives a `lockId` and a TTL.
2. **Typing broadcast** — `src/api/typing-api.js` sends typing-preview messages as the user types. Peers receive `gridTyping` events and `src/rendering/cell.js` renders the preview text.
3. **Lock renewal** — If the TTL is finite, `src/api/locks-api.js` schedules a renewal before expiry. _Needs verification._
4. **Save** — `src/api/cells-api.js` POSTs the new value with the current `rowVer`. The backend validates the version, persists the value, and broadcasts `gridPatch`.
5. **Live patch received by peers** — `src/live/handlers.js` handles `gridPatch` and updates the grid state. `src/rendering/cell.js` re-renders the affected cell.
6. **Release lock** — `src/api/locks-api.js` sends a release request. The backend broadcasts `gridLockChanged` to remove the lock indicator from peers' UIs.
7. **Cleanup** — `src/editing/inline-editor.js` tears down the editing session; any pending typing previews are discarded.

---

## Locking Model

### Lock Identity Keys

> **Needs verification** — the key structure used in `src/api/locks-api.js` must be confirmed. Expected shape: `{ gridId, rowId, columnId }` or similar composite.

### Acquire / Renew / Release Behavior

| Action | Trigger | Expected outcome |
|--------|---------|-----------------|
| Acquire | User starts editing a cell | Server grants lock; `gridLockChanged` broadcast to peers |
| Renew | Timer fires before TTL expires | Server resets TTL; no peer notification expected |
| Release | User commits or cancels edit | Server releases lock; `gridLockChanged` broadcast to peers |
| Auto-expire | TTL elapses without renewal | Server releases lock automatically; peer notification behavior is **Needs verification** |

### TTL and Renewal Timing

> **Needs verification** — TTL value and renewal interval (if any) must be read from `src/api/locks-api.js`.

---

## SignalR Live Events

> Event names below are the _expected_ names from the problem statement. Confirm exact names against `src/live/handlers.js` and the backend hub.

| Event | Direction | Handler action |
|-------|-----------|---------------|
| `gridPatch` | Server → Client | Apply authoritative cell value(s) and update `rowVer` in local state |
| `gridRowAdded` | Server → Client | Insert new row into grid model and re-render |
| `gridRowsDeleted` | Server → Client | Remove rows from grid model and re-render |
| `gridLockChanged` | Server → Client | Update lock indicator on the affected cell (show/hide, show owner) |
| `gridTyping` | Server → Client | Render transient typing preview text in the affected cell |

> All event names and handler behaviors are **Needs verification** against `src/live/handlers.js`.

---

## Typing Preview Rules

- Typing previews are **transient**: they are never persisted and carry no `rowVer`.
- A typing preview is displayed on a cell that is locked by another user.
- When the editing session ends (commit, cancel, or disconnect), the preview is cleared.
- If the editing user's connection drops mid-typing, the preview should clear when the lock TTL expires. _Needs verification._
- There is no ordering guarantee for typing preview messages; later messages may arrive out of order over SignalR. _Needs verification._

---

## Save + Conflict Model with `rowVer`

1. Every row carries a version token (`rowVer`), incremented on each successful save.
2. When saving, the client sends the `rowVer` it last observed for that row.
3. The backend compares the submitted `rowVer` with the stored value:
   - **Match** → save succeeds; `rowVer` increments; `gridPatch` broadcast.
   - **Mismatch** → save is rejected (conflict); the client receives the current server value and `rowVer`.
4. On conflict, `src/ui/conflict-modal.js` presents resolution choices to the user.

> Exact HTTP status code for rejection, payload shape for conflict response, and whether the conflict modal auto-closes are **Needs verification**.

---

## Conflict Modal Behavior

> **Needs verification** — `src/ui/conflict-modal.js` must be inspected to confirm the available choices. Expected behavior based on common patterns:

| Choice | Effect |
|--------|--------|
| **Keep my changes** | Re-submit the save with the server's current `rowVer` (force overwrite) |
| **Accept remote value** | Discard local change; apply the remote value to local state |
| _(Cancel / close)_ | Dismiss modal; cell remains in edited state for the user to decide — **Needs verification** |

---

## Collaboration Invariants

The following behaviors must not be broken by changes to collaboration code:

1. **Only one lock per cell** — at any moment, at most one user holds a lock on a given cell.
2. **No phantom locks** — a lock must be released (or auto-expired) when the editing user disconnects.
3. **`rowVer` monotonicity** — `rowVer` must only increase; a save with a stale version must always be rejected.
4. **Typing previews do not corrupt state** — typing preview messages must never be applied as authoritative values.
5. **Live patches are idempotent** — applying the same `gridPatch` twice must not corrupt grid state (e.g., if a duplicate message arrives).

> Invariants 2, 4, and 5 are asserted by design but must be verified in code.

---

## Known Race-Condition-Sensitive Areas

> All items below are **Needs verification** — they represent common race conditions for this architectural pattern and must be confirmed or dismissed after code review.

1. **Lock acquire vs. concurrent save** — if two users click the same cell simultaneously, both may issue lock-acquire requests before either response arrives. The backend must serialize these; the frontend should handle a rejected acquire gracefully.

2. **Typing preview after lock release** — a `gridTyping` message for a lock that has already been released may arrive after the `gridLockChanged` (released) message due to network reordering. The renderer must tolerate previews for unlocked cells.

3. **`gridPatch` received during active edit** — if a peer saves the same row while the local user is editing it, the `gridPatch` arrives while a local edit session is open. The frontend must decide whether to silently update `rowVer` (risking a conflict on next save) or alert the user immediately.

4. **Reconnect replay** — if the SignalR connection drops and reconnects, the client may miss `gridPatch` or `gridLockChanged` events. Whether the client re-fetches state on reconnect is **Needs verification** (see `src/live/connection.js`).

5. **TTL expiry without renewal** — if the client tab goes to background and the renewal timer is throttled by the browser, the lock may expire server-side while the user believes they still hold it. A subsequent save will fail with a conflict or authorization error.

---

## Reconnect / Disconnect Behavior and Public `live` Event Linkage

> **Needs verification** — inspect `src/live/connection.js` and `src/component.js`.

Expected current observed behavior:

- `src/live/connection.js` manages the SignalR `HubConnection` lifecycle, including automatic reconnect with back-off.
- `src/component.js` listens to connection-state changes and exposes them as public `live` events (e.g., `live:connected`, `live:disconnected`, `live:reconnecting`). _Event names are Needs verification._
- On disconnect, all held locks should be considered released (server-side TTL enforces this). The UI should indicate that real-time collaboration is temporarily unavailable.
- On reconnect, the client should re-subscribe to hub groups and optionally re-fetch the current grid state to recover any missed patches.
- `src/ui/toasts.js` may display connection-state notifications. _Needs verification._

---

## Manual 2-Browser Test Checklist

Use two separate browser sessions (different users) pointed at the same grid to validate the following:

- [ ] **Lock indicator** — User A clicks a cell; User B sees the lock indicator appear on that cell immediately (or within SignalR latency).
- [ ] **Lock exclusivity** — User B cannot start editing the locked cell while User A holds the lock.
- [ ] **Typing preview** — User A types; User B sees the preview text update in near-real time.
- [ ] **Typing preview clears on cancel** — User A presses Escape; User B's preview clears.
- [ ] **Happy-path save** — User A commits; User B sees the updated value appear without a reload.
- [ ] **`rowVer` conflict** — User A and User B both open the same row. User A saves first. User B tries to save → conflict modal appears for User B.
- [ ] **Conflict: keep my changes** — User B chooses "Keep my changes"; value updates to User B's input; User A sees `gridPatch`.
- [ ] **Conflict: accept remote value** — User B chooses "Accept remote value"; cell shows User A's saved value.
- [ ] **Row added** — User A adds a row; User B sees it appear immediately.
- [ ] **Rows deleted** — User A deletes one or more rows; User B sees them disappear immediately.
- [ ] **Disconnect / reconnect** — Disable User A's network briefly; restore; confirm User A's lock is released and grid state is consistent.
- [ ] **Tab backgrounding** — Put User A's tab in background for longer than lock TTL; User A attempts to save → verify graceful error or conflict, not a silent corrupt save.

---

## Needs Verification

The following items require inspection of the actual source code before this document can be considered authoritative:

| # | Item | Files to inspect |
|---|------|-----------------|
| 1 | Lock identity key structure (fields used to identify a specific cell lock) | `src/api/locks-api.js` |
| 2 | Lock TTL value and renewal interval | `src/api/locks-api.js` |
| 3 | Exact HTTP verb and endpoint for lock acquire / renew / release | `src/api/locks-api.js` |
| 4 | Typing broadcast debounce interval | `src/api/typing-api.js` |
| 5 | Exact SignalR event names (confirm `gridPatch`, `gridRowAdded`, `gridRowsDeleted`, `gridLockChanged`, `gridTyping`) | `src/live/handlers.js` |
| 6 | `gridPatch` payload schema | `src/live/handlers.js` |
| 7 | Conflict HTTP status code and response payload shape | `src/api/cells-api.js` |
| 8 | Conflict modal resolution choices and auto-close behavior | `src/ui/conflict-modal.js` |
| 9 | Public `live` event names exposed by `src/component.js` | `src/component.js` |
| 10 | Reconnect strategy (back-off config, state re-fetch on reconnect) | `src/live/connection.js` |
| 11 | Whether `src/ui/toasts.js` is used for connection/conflict UX | `src/ui/toasts.js` |
| 12 | How `gridPatch` received during an active edit session is handled | `src/live/handlers.js`, `src/editing/inline-editor.js` |
| 13 | Whether lock auto-expiry triggers a `gridLockChanged` event to peers | Backend hub / `src/live/handlers.js` |
| 14 | All items in `docs/grid/_code-verified-notes.md` (file not yet present) | `docs/grid/_code-verified-notes.md` |

---

## Related Docs

- `docs/grid/_code-verified-notes.md` — code-verified implementation notes (not yet present in repo)
- `README.md` — project overview

---

_Last updated: 2026-02-22. This document was authored before the referenced source files were present in the repository; all behavioral claims require code verification._
