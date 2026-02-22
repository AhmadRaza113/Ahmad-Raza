# Sheet Grid — Code-Verified Notes

This log records what has been directly verified against source code versus what
still needs confirmation.  Update this file whenever a claim is resolved.

> **Principle**: the root source code is the **single source of truth**.
> Documentation claims that cannot be traced to a line of code must be marked
> **Needs verification** below and must not be presented as established facts in
> other docs.

---

## Verification date

Last checked: 2026-02-22  
Files inspected: `index.html`, `sheet-grid.js`, `src/component.js`,
`src/api/client.js`, `src/api/endpoints.js`, `src/live/hub.js`,
`src/live/handlers.js`, `src/state/normalize.js`,
`src/editing/inline-editor.js`, `src/ui/conflict-modal.js`.

---

## ✅ Verified items

### Attribute names (`src/component.js` → `observedAttributes`)
- `api-base` ✅
- `client-id` ✅
- `user-id` ✅
- `storage-key` ✅
- `readonly` ✅ (boolean presence attribute; checked via `hasAttribute`)

### Event names (`src/component.js`)
- `live` ✅ — `CustomEvent`, `bubbles: true`, `composed: true`
  - `detail.connected` : boolean ✅
  - `detail.reason` : string, present only when disconnected ✅
- `toast` ✅ — `CustomEvent`, `bubbles: true`, `composed: true`
  - `detail.message` : string ✅
  - `detail.level` : `'info' | 'warn' | 'error'` ✅

### SignalR event names (`src/live/hub.js` → `connection.on(...)`)
- `RowUpdated` ✅
- `RowLocked` ✅
- `RowUnlocked` ✅
- `ConflictDetected` ✅

### REST endpoint paths (`src/api/client.js`, `src/api/endpoints.js`)
- `GET  /rows` ✅
- `GET  /rows/:rowId` ✅
- `PUT  /rows/:rowId` ✅
- `POST   /rows/:rowId/lock` ✅
- `DELETE /rows/:rowId/lock` ✅
- `GET  /columns` ✅

### Canonical field names (`src/state/normalize.js`)
- `rowId` ✅ (alias: `id`)
- `rowVer` ✅ (alias: `version`)
- `colId` ✅ (alias: `id`)
- `values` ✅ (`Record<string, unknown>` keyed by `colId`)
- `clientId` ✅ (in request bodies and SignalR payloads)
- `lockedBy` ✅ (`string | null`)

### File paths
All files listed in `docs/grid/module-map.md` have been verified to exist on
disk as of the last verification date above.

---

## ⚠️ Needs verification (backend / external)

These items cannot be confirmed from the frontend source alone because the
backend (`auditor-grid-api`) source code is not present in this repository.

1. **Hub route** — `src/live/hub.js` connects to `{api-base}/hubs/grid`.
   Confirm the exact SignalR hub route with the auditor-grid-api team.

2. **Lock enforcement** — It is unknown whether the server rejects `PUT`
   requests from clients that do not hold the row lock.  See
   `docs/grid/collaboration-model.md`.

3. **`GET /rows` pagination** — Query parameters (`page`, `pageSize`, etc.) are
   not confirmed from the backend.  `ApiClient.getRows()` currently makes a
   plain `GET /rows` with no pagination parameters.

4. **`rowVer` type on server** — Documented as `number` (int); confirm the
   server does not use a string or GUID for versioning.

5. **SignalR payload field names** — The field names in `RowUpdated`,
   `RowLocked`, `RowUnlocked`, and `ConflictDetected` payloads (e.g.
   `serverValues`, `clientValues`) are defined client-side; confirm exact
   casing with the server implementation.

6. **Column `type` enum** — `normalizeColumns()` defaults `type` to `'text'`.
   The full set of supported type values is not confirmed.

7. **`X-Client-Id` header enforcement** — The header is sent on every request;
   whether the server uses it for idempotency or tracing is unconfirmed.

8. **Authentication** — No auth token / cookie handling is present in
   `ApiClient`.  Confirm whether auth is handled by a reverse proxy, browser
   cookie, or needs to be added to the component.

---

## Change checklist

When a "Needs verification" item above is resolved:

- [ ] Move it to the "Verified items" section with a ✅
- [ ] Update the relevant doc section in `public-api.md`, `data-contracts.md`,
      or `collaboration-model.md`
- [ ] Update the verification date at the top of this file
