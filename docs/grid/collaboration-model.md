# Sheet Grid — Collaboration Model

> **Source of truth**: [`src/component.js`](../../src/component.js),
> [`src/live/hub.js`](../../src/live/hub.js),
> [`src/live/handlers.js`](../../src/live/handlers.js),
> [`src/ui/conflict-modal.js`](../../src/ui/conflict-modal.js).

---

## Overview

The grid supports real-time multi-user editing through a combination of:

1. **Optimistic concurrency** — each row carries a `rowVer` counter.  A `PUT`
   that sends a stale `rowVer` receives `HTTP 409` from the server.
2. **Row-level locking** — a client may acquire an exclusive edit lock via
   `POST /rows/:rowId/lock` before entering edit mode.
3. **SignalR push** — the server broadcasts state changes to all connected
   clients so every grid reflects the latest data without polling.

> **Needs verification**: Whether row-level locking is enforced server-side
> (i.e. the server rejects `PUT` requests from clients that do not hold the
> lock) is not confirmed from available backend code.

---

## Connection lifecycle

```
sheet-grid connected
  └─> _boot()
        ├─ ApiClient.getRows()    → initial row data
        ├─ ApiClient.getColumns() → column definitions
        └─ GridHub.start()
              └─ HubConnection.start() resolves
                    └─ fires `live` event  { connected: true }

Any disconnect / error
  └─ fires `live` event  { connected: false, reason: "..." }

Automatic reconnect (withAutomaticReconnect())
  └─ fires `live` event  { connected: true }

sheet-grid disconnected (element removed from DOM)
  └─ GridHub.stop()
```

Hub URL: `{api-base}/hubs/grid`

> **Needs verification**: confirm exact hub route with the auditor-grid-api team.

---

## Edit flow (happy path)

```
User double-clicks cell
  └─ InlineEditor._startEdit(td)
       sets td.contentEditable = 'true', td.dataset.editing = ''

User presses Enter
  └─ InlineEditor._commit()
       calls onCommit({ rowId, colId, value })
         └─ SheetGrid._commitEdit()
              ApiClient.updateRow(rowId, { rowVer, values, clientId })
                └─ PUT /rows/:rowId  →  200 OK
```

### Readonly guard

When the `readonly` attribute is present on `<sheet-grid>`:
- `InlineEditor` is not attached to the `<tbody>`.
- `SheetGrid._commitEdit()` returns early without calling the API.
- Cells render without `tabindex`, preventing keyboard focus.

---

## Concurrent edit — conflict flow

```
Client A and Client B both load the same row at rowVer = 5.

Client A saves first  →  PUT /rows/r1  { rowVer: 5 }  →  200, rowVer becomes 6
  Server broadcasts RowUpdated { rowId, rowVer: 6, values, clientId: A }

Client B (still at rowVer 5) saves  →  PUT /rows/r1  { rowVer: 5 }  →  409
  Server broadcasts ConflictDetected {
    rowId, rowVer: 6,
    serverValues: { … },   ← what A saved
    clientValues: { … },   ← what B tried to save
    clientId: B
  }

SheetGrid._onConflictDetected() fires on both clients,
  but only acts when payload.clientId === this.clientId (Client B).
    └─ ConflictModal.show({ rowId, rowVer: 6, serverValues, clientValues })
         User clicks "Keep My Version" or "Keep Server Version"
           └─ onResolve({ rowId, values, rowVer: 6 })
                └─ SheetGrid._applyResolution()
                     ApiClient.updateRow(rowId, { rowVer: 6, values, clientId })
```

---

## Row locking

`POST /rows/:rowId/lock` and `DELETE /rows/:rowId/lock` are available in
`ApiClient` but are **not yet wired into the automatic edit flow** in
`src/component.js`.  The server broadcasts `RowLocked` / `RowUnlocked` events
which the grid reflects visually (locked rows get `data-locked` attribute and
a yellow background).

> **Needs verification**: whether automatic lock acquisition before edit
> is planned.  Currently the flow is: user edits → save → potential conflict,
> without a prior lock step.

---

## SignalR event handling summary

| Server event       | Handler in `component.js`    | Effect |
|--------------------|------------------------------|--------|
| `RowUpdated`       | `_onRowUpdated()`            | Updates local row, re-renders, emits `toast` if from another client |
| `RowLocked`        | `_onRowLocked()`             | Sets `lockedBy`, re-renders |
| `RowUnlocked`      | `_onRowUnlocked()`           | Clears `lockedBy`, re-renders |
| `ConflictDetected` | `_onConflictDetected()`      | Opens `ConflictModal` if `clientId` matches this client |

---

## Change checklist

When changing the collaboration model in `src/component.js` or `src/live/`:

- [ ] Update the Connection lifecycle diagram if hub URL or lifecycle changes
- [ ] Update the Edit flow if locking is added to the automatic path
- [ ] Update the Conflict flow if resolution strategy changes
- [ ] Update the SignalR event table if events are added or renamed
- [ ] Cross-check with `services/auditor-grid-api/docs/signalr-events.md`
