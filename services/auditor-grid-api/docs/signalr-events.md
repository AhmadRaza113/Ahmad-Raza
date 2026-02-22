# auditor-grid-api — SignalR Events

> **Source of truth (client side)**: [`src/live/hub.js`](../../../src/live/hub.js).
> The event names registered in that file are the canonical reference for the
> frontend.  The server-side implementation is not available in this repository;
> items below that depend on backend internals are marked **Needs verification**.

---

## Hub endpoint

| Item | Value |
|------|-------|
| Hub URL | `{api-base}/hubs/grid` |
| Protocol | ASP.NET Core SignalR (JSON) |
| Client library | `@microsoft/signalr` v8+ |
| Connection headers | `X-Client-Id` (from `client-id` attribute), `X-User-Id` (from `user-id` attribute) |

> **Needs verification**: confirm exact hub URL and SignalR protocol version
> with the auditor-grid-api team.

---

## Server → client events

### `RowUpdated`

Broadcast when a row is successfully updated by any client.

```json
{
  "rowId":    "row-42",
  "rowVer":   7,
  "values":   { "colA": "new value", "colB": 99 },
  "clientId": "tab-abc123"
}
```

| Field      | Type   | Description |
|------------|--------|-------------|
| `rowId`    | string | Row that was updated. |
| `rowVer`   | number | New version after the update. |
| `values`   | object | Full values map (keyed by `colId`) as stored. |
| `clientId` | string | Client that performed the update; recipients compare with own `client-id`. |

**Client handler**: `SheetGrid._onRowUpdated()` in `src/component.js`.
Also expressed as pure function `applyRowUpdated()` in `src/live/handlers.js`.

> **Needs verification**: whether `values` is the full row or only changed
> columns (delta).

---

### `RowLocked`

Broadcast when a client acquires an edit lock on a row.

```json
{
  "rowId":    "row-42",
  "userId":   "user-17",
  "clientId": "tab-abc123"
}
```

| Field      | Type   | Description |
|------------|--------|-------------|
| `rowId`    | string | Row that is now locked. |
| `userId`   | string | User who holds the lock. |
| `clientId` | string | Client session that acquired the lock. |

**Client handler**: `SheetGrid._onRowLocked()` in `src/component.js`.
Also expressed as pure function `applyRowLocked()` in `src/live/handlers.js`.

---

### `RowUnlocked`

Broadcast when an edit lock is released (explicit release or connection drop).

```json
{
  "rowId": "row-42"
}
```

| Field   | Type   | Description |
|---------|--------|-------------|
| `rowId` | string | Row whose lock was released. |

**Client handler**: `SheetGrid._onRowUnlocked()` in `src/component.js`.
Also expressed as pure function `applyRowUnlocked()` in `src/live/handlers.js`.

> **Needs verification**: whether the server automatically releases locks
> when a client disconnects.

---

### `ConflictDetected`

Broadcast (only to the conflicting client) when a `PUT /rows/:rowId` is
rejected because `rowVer` is stale.

```json
{
  "rowId":        "row-42",
  "rowVer":       8,
  "serverValues": { "colA": "server value" },
  "clientValues": { "colA": "my value" },
  "clientId":     "tab-abc123"
}
```

| Field          | Type   | Description |
|----------------|--------|-------------|
| `rowId`        | string | Row with the conflict. |
| `rowVer`       | number | Server's current (winning) version. |
| `serverValues` | object | Values currently on the server. |
| `clientValues` | object | Values the client attempted to save. |
| `clientId`     | string | Client that caused the conflict; only that client opens the resolution modal. |

**Client handler**: `SheetGrid._onConflictDetected()` in `src/component.js`,
which opens `ConflictModal` only when `payload.clientId === this.clientId`.

> **Needs verification**: whether `ConflictDetected` is sent only to the
> conflicting client (targeted) or broadcast to all (and filtered client-side).
> The current client code filters client-side as a safety measure either way.

---

## Client → server

The grid component does **not** invoke any hub methods directly.  All writes
go through the REST API (`PUT /rows/:rowId`, `POST/DELETE /rows/:rowId/lock`).
SignalR is receive-only from the client's perspective.

> **Needs verification**: confirm no hub method invocations are expected.

---

## Connection headers reference

| Header        | Value source | Purpose |
|---------------|--------------|---------|
| `X-Client-Id` | `client-id` attribute | Identifies the browser tab / session |
| `X-User-Id`   | `user-id` attribute   | Identifies the authenticated user |

---

## Change checklist

When adding or changing a SignalR event:

- [ ] Update the event name in `src/live/hub.js` (`connection.on(...)`)
- [ ] Add or update the handler in `src/component.js`
- [ ] Add or update the pure function in `src/live/handlers.js`
- [ ] Update this document (payload fields, description)
- [ ] Update `docs/grid/collaboration-model.md` (SignalR event table)
- [ ] Update `docs/grid/_code-verified-notes.md` (verified SignalR event names)
- [ ] Update `docs/grid/data-contracts.md` if payload fields change
