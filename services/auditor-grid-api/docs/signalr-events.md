# SignalR Events — Auditor Grid API

## Purpose

This document is the backend-oriented contract reference for all Azure SignalR events emitted
by the Auditor Grid API. It is intended to help backend developers understand what events are
produced, when they are produced, and what payload shape the frontend expects to receive.

**Primary source of truth:** backend source files in `src/` (code-verified).  
Frontend event listeners live in `src/live/handlers.js`, `src/live/connection.js`, `src/component.js`,
and `src/api/client.js` in the corresponding frontend project — those files were not present in this
repository at time of writing, so frontend-specific expectations are labeled **[frontend inferred]**
or **[needs verification]** throughout.

---

## Status

Covers the **current grid feature scope only**:
- Real-time cell patching
- Row add / delete
- Cell-level locking
- Collaborative typing indicators

---

## SignalR Overview

The backend uses **Azure SignalR Service** via the Azure Functions `SignalR` output and trigger
bindings (`@azure/functions` v4 SDK, extension bundle `4.x`).

All grid events are broadcast to a **per-client group** named `client:{clientId}` (see
[Client Scoping](#client-scoping-clientid)). Only browser sessions that negotiated with the
same `clientId` receive each event.

---

## Negotiate Endpoint Contract

### Path

```
POST /api/negotiate
GET  /api/negotiate
```

`OPTIONS /api/negotiate` returns `204 No Content` (CORS preflight).

### Query Parameters

| Parameter  | Type    | Required | Description |
|------------|---------|----------|-------------|
| `userId`   | string  | No       | Caller-supplied user identity. Falls back to `"anonymous"` if omitted. Used to bind the SignalR connection to a userId so the disconnect trigger can identify which locks to release. |
| `clientId` | integer | No*      | Tenant/client scope. If provided the user is added to the SignalR group `client:{clientId}`. **Without `clientId` the user receives no grid events.** |

\* `clientId` is effectively required for any real-time grid functionality.

### Response

HTTP `200 OK`, `Content-Type: application/json`.  
Body is the Azure SignalR connection info object:

```json
{
  "url": "https://<signalr-service>.service.signalr.net/client/?hub=auditorGrid",
  "accessToken": "<JWT>"
}
```

The frontend uses `url` and `accessToken` to connect to the hub using the SignalR JavaScript
client (e.g. `@microsoft/signalr`).

### Side Effects

If `clientId` is supplied the backend issues an `add` group action that places the authenticated
`userId` into the group `client:{clientId}` via the SignalR output binding. This happens
**before** the connection info is returned.

---

## Hub Name

| Source | Value |
|--------|-------|
| `src/signalrBindings.js` | `process.env.SIGNALR_HUB || "auditorGrid"` |

**Default hub name: `auditorGrid`**.  
Override with the `SIGNALR_HUB` environment variable in Azure Function App settings.

---

## Event Naming Rules

- All event names use **camelCase**.
- The prefix `grid` is used for all events produced by this service.
- Names are **exact and case-sensitive**; the frontend registers listeners by name.

---

## Events

### `gridPatch`

**Emitted by:** `POST /api/auditorRequests/batch`  
**Trigger:** One or more cells were successfully updated in the database.  
**Broadcast to:** `client:{clientId}` group.

#### Purpose

Notifies all connected sessions for the client that one or more cell values have changed,
along with updated `rowVer` tokens for optimistic concurrency.

> **Note:** Only updates with `status: "updated"` are included in the broadcast. Conflicts,
> missing-row errors, and locked-cell skips are **not** broadcast — they are returned only in
> the HTTP response to the caller. If all updates in the batch fail (all conflicts, etc.) **no
> `gridPatch` event is emitted at all.**

#### Payload

```jsonc
{
  "clientId": 123,                        // integer — tenant scope
  "byUser": "user@example.com",           // string | null — who made the change
  "atUtc": "2024-01-15T10:30:00.000Z",    // ISO 8601 UTC timestamp

  "patches": [
    {
      "kind": "cell",                     // always "cell" in current implementation
      "rowId": "550e8400-e29b-41d4-a716-446655440000",  // UUID string
      "colId": "auditor_request",         // see Editable Column IDs below
      "value": "Updated text",            // new cell value (always string)
      "rowVer": "AQIDBAUGB==",            // base64-encoded 8-byte SQL rowversion
      "updatedAt": "2024-01-15T10:30:00.000Z",  // UTC ISO 8601
      "updatedBy": "user@example.com"     // string | null
    }
    // ... one object per successfully updated cell
  ]
}
```

#### Editable Column IDs (`colId`)

Only these `colId` values can appear in `patches` — all others are rejected by the backend:

| `colId`                   | SQL Column              |
|---------------------------|-------------------------|
| `auditor_request`         | `AuditorRequest`        |
| `host_comments`           | `HostComments`          |
| `host_backroom_comments`  | `HostBackroomComments`  |
| `assigned_to`             | `AssignedTo`            |
| `status`                  | `Status`                |
| `requested_department`    | `RequestedDepartment`   |
| `request_type`            | `RequestType`           |

#### Frontend Expectations

- **[frontend inferred]** The receiver updates each `(rowId, colId)` cell in the local grid
  state with `value` and stores `rowVer` for use as `baseRowVer` in the next batch call.
- **[frontend inferred]** `byUser` is compared against the local user's identity so the sender
  can ignore its own echoed patch (or apply it to confirm the save).

---

### `gridRowAdded`

**Emitted by:** `POST /api/auditorRequests/rows`  
**Trigger:** A new row was inserted into `dbo.AuditorRequests`.  
**Broadcast to:** `client:{clientId}` group.

#### Purpose

Notifies all sessions that a new row exists and provides its full initial state.

#### Payload

```jsonc
{
  "row": {                                // full row shape (see Row Shape below)
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "reqNo": "MA-001",
    "seqNum": 1,
    "clientId": 123,
    "rowVer": "AQIDBAUGB==",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "updatedBy": null,
    "values": { /* ... */ }
  },
  "byUser": "user@example.com",           // string | null
  "atUtc": "2024-01-15T10:30:00.000Z"    // ISO 8601 UTC
}
```

#### Frontend Expectations

- **[frontend inferred]** The receiver appends the `row` to the local grid row collection.
- **[frontend inferred]** If the local user was the one who added the row the UI may scroll
  to or highlight the new row.

---

### `gridRowsDeleted`

**Emitted by:** `POST /api/auditorRequests/rows/delete`  
**Trigger:** One or more rows were deleted from `dbo.AuditorRequests`.  
**Broadcast to:** `client:{clientId}` group.

#### Purpose

Notifies all sessions to remove the specified rows from their local state.

#### Payload

```jsonc
{
  "rowIds": [
    "550e8400-e29b-41d4-a716-446655440000",
    "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
  ],                                      // array of UUID strings
  "byUser": "user@example.com",           // string | null
  "atUtc": "2024-01-15T10:30:00.000Z"    // ISO 8601 UTC
}
```

> **Note:** The backend deletes in batches of 50 within a single transaction. All `rowIds`
> from the request are included in one `gridRowsDeleted` event regardless of batch chunking.

#### Frontend Expectations

- **[frontend inferred]** The receiver removes each `rowId` from the local grid collection.
- **[frontend inferred]** Any selected/focused cells referencing deleted rows are cleared.

---

### `gridLockChanged`

**Emitted by:**
- `POST /api/locks/acquire` (on successful acquisition)
- `POST /api/locks/release` (on successful release)
- `signalr_disconnected` trigger (on unexpected disconnect, per released lock)

**Broadcast to:** `client:{clientId}` group.

#### Purpose

Notifies all sessions that the lock state for a specific `(rowId, colId)` cell has changed.
Frontend uses this to show or clear lock indicators so users know which cells are being edited
by someone else.

> **Note:** Lock renew (`POST /api/locks/renew`) does **not** emit `gridLockChanged`.

#### Payload — Lock Acquired

```jsonc
{
  "clientId": 123,                        // integer
  "rowId": "550e8400-e29b-41d4-a716-446655440000",
  "colId": "auditor_request",
  "locked": true,
  "userId": "user@example.com",
  "ttlSeconds": 30,                       // integer, 5–300 (default 30)
  "atUtc": "2024-01-15T10:30:00.000Z"
}
```

#### Payload — Lock Released

Released via `POST /api/locks/release` or via the disconnect handler:

```jsonc
{
  "clientId": 123,
  "rowId": "550e8400-e29b-41d4-a716-446655440000",
  "colId": "auditor_request",
  "locked": false,
  "userId": "user@example.com",
  // NOTE: ttlSeconds is absent on release
  "atUtc": "2024-01-15T10:30:00.000Z"
}
```

#### Frontend Expectations

- **[frontend inferred]** `locked: true` → render a lock indicator on `(rowId, colId)`,
  showing `userId` as the lock holder.
- **[frontend inferred]** `locked: false` → clear the lock indicator for `(rowId, colId)`.
- **[frontend inferred]** Frontend should tolerate `ttlSeconds` being absent on release events.

---

### `gridTyping`

**Emitted by:**
- `POST /api/typing` (lightweight relay — **no database writes**)
- `signalr_disconnected` trigger (best-effort typing-end per released lock)

**Broadcast to:** `client:{clientId}` group.

#### Purpose

Relays real-time typing presence so other sessions can show a "someone is typing" indicator on
the cell being edited. This is purely ephemeral — no data is persisted.

On disconnect, the backend emits `gridTyping` with `ended: true` for each lock the disconnecting
user held, so that typing indicators are cleared even if the browser's `beforeunload` beacon did
not fire.

#### Payload — Active Typing

```jsonc
{
  "clientId": 123,
  "rowId": "550e8400-e29b-41d4-a716-446655440000",
  "colId": "auditor_request",
  "userId": "user@example.com",
  "value": "partial text being typed",    // string (may be empty); null when ended
  "ended": false,
  "atUtc": "2024-01-15T10:30:00.000Z"
}
```

#### Payload — Typing Ended

Sent when `ended: true` (or equivalent shape accepted by `/api/typing`), or on disconnect:

```jsonc
{
  "clientId": 123,
  "rowId": "550e8400-e29b-41d4-a716-446655440000",
  "colId": "auditor_request",
  "userId": "user@example.com",
  "value": null,                          // always null when ended
  "ended": true,
  "atUtc": "2024-01-15T10:30:00.000Z"
}
```

#### Accepted `ended` signals (backend `POST /api/typing`)

The backend accepts any of these body shapes to treat the event as a typing-end:

| Field/Value             | Interpretation |
|-------------------------|----------------|
| `"ended": true`         | End           |
| `"isEnd": true`         | End           |
| `"action": "end"`       | End           |
| `"action": "stop"`      | End           |
| `"action": "typing_end"` | End          |
| `"value": null`         | End           |

#### Frontend Expectations

- **[frontend inferred]** `ended: false` → display a typing badge/highlight for `(rowId, colId, userId)`.
- **[frontend inferred]** `ended: true` → remove the typing badge for `(rowId, colId, userId)`.
- **[frontend inferred]** The sender's own `gridTyping` echoes may be filtered by matching
  `userId` against the local user.

> **Race condition note:** Typing events are best-effort. A `gridTyping { ended: false }` may
> arrive after a `gridTyping { ended: true }` if packets are reordered. Frontends should clear
> the indicator as soon as any `ended: true` arrives for a given `(rowId, colId, userId)`, and
> use a short debounce (e.g. 3–5 s) to auto-clear stale indicators.

---

## Row Shape

The `row` object included in `gridRowAdded` (and returned by REST endpoints) has this structure:

```jsonc
{
  "id": "550e8400-e29b-41d4-a716-446655440000",  // UUID — primary key
  "reqNo": "MA-01",             // string | null — display request number (e.g. "MA-01")
  "seqNum": 1,                  // integer | null — sequential number
  "clientId": 123,              // integer — tenant scope
  "rowVer": "AQIDBAUGB==",      // base64 string — 8-byte SQL rowversion for optimistic concurrency
  "updatedAt": "2024-01-15T10:30:00.000Z",  // ISO 8601 UTC | null
  "updatedBy": "user@example.com",          // string | null

  "values": {
    // Editable columns (can appear in gridPatch.patches[].colId)
    "auditor_request": "",
    "host_comments": "",
    "host_backroom_comments": "",
    "assigned_to": "",
    "status": "",
    "requested_department": "",
    "request_type": "",

    // Read-only columns (never in gridPatch; display only)
    "due_datetime": "2024-01-15T14:30",  // "YYYY-MM-DDTHH:mm" local time | ""
    "client_name": "",
    "closed_time": "2024-01-15T14:30",   // "YYYY-MM-DDTHH:mm" local time | ""
    "completed_on": "2024-01-15T14:30",  // "YYYY-MM-DDTHH:mm" local time | ""
    "client_id": ""                      // ClientInternalId field
  }
}
```

> **Important:** `due_datetime`, `closed_time`, and `completed_on` are formatted as local time
> strings (`YYYY-MM-DDTHH:mm`) by the backend — not UTC ISO 8601. All other timestamps
> (`updatedAt`, `atUtc`) are UTC ISO 8601.

---

## Client Scoping (`clientId`)

All SignalR messages are sent exclusively to the group `client:{clientId}`.

- **Negotiate:** adds the connecting user to `client:{clientId}` at connection time.
- **Events:** every broadcast uses `groupName: "client:{clientId}"` in the SignalR output binding.
- Sessions without a matching `clientId` in their group membership receive **no events**.
- `clientId` must be a **32-bit integer** throughout; string or float values are rejected with
  `400 Bad Request`.

---

## Ordering and Consistency Notes

| Scenario | Behavior |
|----------|----------|
| Concurrent batch edits to the same cell | Backend detects row-version mismatch (`status: "conflict"`); the losing caller must re-fetch and retry. No `gridPatch` for the conflicting cell. |
| Multiple successful patches in one batch | All included in a **single** `gridPatch` event. |
| Batch with mixed success/conflict | Only successful patches appear in `gridPatch`. |
| Row deleted while another user is editing | Next save attempt returns `status: "missing"`. No `gridRowsDeleted` is emitted for the ongoing edit session. |
| Typing events | Best-effort, no ordering guarantees. Auto-expire indicators client-side after a debounce window. |
| Disconnect | Lock and typing events are broadcast for each released lock. These may arrive slightly after the user is gone. |

---

## Payload Compatibility Rules

### Safe (non-breaking) additions

| Change | Safe? |
|--------|-------|
| Adding a new field to any event payload | ✅ Yes — frontends must ignore unknown fields |
| Adding a new `colId` to `COL_MAP` (new editable column) | ✅ Yes |
| Adding a new `values.*` key to the row shape | ✅ Yes |
| Adding a new event the frontend doesn't handle yet | ✅ Yes |

### Breaking changes

| Change | Breaking? |
|--------|-----------|
| Renaming an event (e.g. `gridPatch` → `gridCellPatch`) | ❌ Yes — must be coordinated with frontend |
| Removing or renaming a required payload field | ❌ Yes |
| Changing `clientId` type from integer to string | ❌ Yes |
| Changing `rowVer` encoding format | ❌ Yes |
| Removing a `colId` from `COL_MAP` | ⚠️ Breaking for any frontend column using it |

---

## Backend + Frontend Testing Checklist (2-Browser Sessions)

Use two browser sessions (different users, same `clientId`) to verify all real-time paths.

### Setup

- [ ] Both sessions call `GET /api/negotiate?userId=<user>&clientId=<id>` and connect to hub.
- [ ] Confirm both sessions are in group `client:{clientId}` (verify by triggering an event in one and observing the other).

### `gridPatch`

- [ ] Session A edits a cell and saves.
- [ ] Session B receives `gridPatch` with correct `rowId`, `colId`, `value`, and `rowVer`.
- [ ] Session A's `rowVer` is updated in the HTTP response; Session B's `rowVer` matches.
- [ ] Conflicting edit: Sessions A and B both read the same row, Session A saves first. Session B's save returns `status: "conflict"` with no `gridPatch` emitted for that cell.

### `gridRowAdded`

- [ ] Session A calls `POST /api/auditorRequests/rows`.
- [ ] Session B receives `gridRowAdded` with the full row shape.
- [ ] Both sessions have the same `rowId` and initial `rowVer`.

### `gridRowsDeleted`

- [ ] Session A calls `POST /api/auditorRequests/rows/delete` with valid `rowIds`.
- [ ] Session B receives `gridRowsDeleted` with the matching `rowIds` array.
- [ ] Deleted rows no longer appear on page refresh.

### `gridLockChanged`

- [ ] Session A acquires lock: `POST /api/locks/acquire` with `rowId`, `colId`, `userId`.
- [ ] Session B receives `gridLockChanged { locked: true, ttlSeconds, userId }`.
- [ ] Session A releases lock: `POST /api/locks/release`.
- [ ] Session B receives `gridLockChanged { locked: false }` (no `ttlSeconds`).
- [ ] Session A closes the browser tab without releasing.
- [ ] After disconnect, Session B receives `gridLockChanged { locked: false }` from the disconnect handler.

### `gridTyping`

- [ ] Session A sends `POST /api/typing` with `value: "hello"`, `ended: false`.
- [ ] Session B receives `gridTyping { value: "hello", ended: false }`.
- [ ] Session A sends `POST /api/typing` with `ended: true`.
- [ ] Session B receives `gridTyping { value: null, ended: true }`.
- [ ] Session A disconnects while typing (no explicit end sent).
- [ ] Session B receives `gridTyping { ended: true }` from disconnect handler.

---

## Needs Verification

The following backend details could not be fully verified from backend source code alone, or
depend on frontend behavior that was not visible in this repository:

| Item | Status |
|------|--------|
| Frontend handler code in `src/live/handlers.js` | **Not present in repo** — all frontend expectations are inferred |
| `docs/grid/_code-verified-notes.md` | **Not present in repo** — could not be consulted |
| Whether frontend filters its own echoed `gridPatch` events (by matching `byUser`) | **[needs verification]** |
| Whether frontend auto-retries on `gridPatch` race condition (applies its own version) | **[needs verification]** |
| Lock TTL auto-renewal strategy in frontend (keepalive interval) | **[needs verification]** |
| Hub URL path used by frontend SignalR client (`negotiate` endpoint URL) | **[needs verification]** |
| Whether `reqNo` / `seqNum` are database computed columns, triggers, or assigned by another service | **[needs verification]** — `mapping.js` reads them from DB but neither the insert path in `auditorRequests.js` nor any visible code sets them; the assignment mechanism is unknown |
| `due_datetime` / `closed_time` / `completed_on` — timezone of local-time formatted values | **[needs verification]** — server local time, may differ from client timezone |
| SignalR connection retry/reconnect policy in frontend | **[needs verification]** |
| Whether broadcasts use Azure SignalR "Serverless" or "Default" mode | **[needs verification]** — output binding is used (Serverless is implied but not confirmed) |

---

## Related Docs

- `src/signalrBindings.js` — Hub name and binding definitions (backend source)
- `src/functions/negotiate.js` — Negotiate endpoint implementation
- `src/functions/auditorRequests.js` — `gridPatch`, `gridRowAdded`, `gridRowsDeleted` emitters
- `src/functions/locks.js` — `gridLockChanged` emitter (acquire / release)
- `src/functions/typing.js` — `gridTyping` relay
- `src/functions/signalrDisconnected.js` — Disconnect cleanup (lock + typing sweep)
- `src/lock.js` — Redis-based lock implementation (TTL, Lua atomic renew/release)
- `src/mapping.js` — Row shape mapping and editable column list (`COL_MAP`)
- `host.json` — Azure Functions host config (route prefix `api`, extension bundle `4.x`)
