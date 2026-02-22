# Sheet Grid — Data Contracts

> **Source of truth**: [`src/state/normalize.js`](../../src/state/normalize.js),
> [`src/api/client.js`](../../src/api/client.js),
> [`src/live/handlers.js`](../../src/live/handlers.js).
> Canonical field names are defined in `normalize.js`; any server aliases are
> resolved there before the rest of the codebase sees the data.

---

## Canonical terminology

The following names are used consistently across all grid source files and docs.
Do not substitute synonyms without updating `normalize.js`.

| Canonical name | Type            | Description |
|----------------|-----------------|-------------|
| `rowId`        | string          | Unique row identifier. |
| `rowVer`       | number (int)    | Optimistic-concurrency version counter.  Increments on every successful write. |
| `colId`        | string          | Unique column identifier. |
| `values`       | `{[colId]: any}` | Map of column values for one row. |
| `clientId`     | string          | Value of the `client-id` attribute; identifies the browser tab / session. |
| `lockedBy`     | string \| null  | `userId` of the user holding the edit lock, or `null`. |

---

## Row

Shape after normalization (output of `normalizeRows()`):

```ts
interface Row {
  rowId:    string;
  rowVer:   number;
  values:   Record<string, unknown>;  // keyed by colId
  lockedBy: string | null;            // null when not locked
}
```

### Server aliases accepted by `normalizeRows()`

| Canonical | Accepted server alias |
|-----------|-----------------------|
| `rowId`   | `id`                  |
| `rowVer`  | `version`             |

Other fields pass through as-is.

---

## Column

Shape after normalization (output of `normalizeColumns()`):

```ts
interface Column {
  colId:    string;
  label:    string;   // display name
  type:     string;   // e.g. 'text', 'number', 'date' — Needs verification: full enum
  readonly: boolean;
}
```

### Server aliases accepted by `normalizeColumns()`

| Canonical | Accepted server alias |
|-----------|-----------------------|
| `colId`   | `id`                  |
| `label`   | `name`                |

---

## CellEdit (inline edit commit payload)

Produced by `InlineEditor` and consumed by `SheetGrid._commitEdit()`.

```ts
interface CellEdit {
  rowId: string;
  colId: string;
  value: string;   // always string at this stage; coercion is server-side
}
```

---

## Row update request body (PUT /rows/:rowId)

Sent by `ApiClient.updateRow()`:

```json
{
  "rowVer":   42,
  "values":   { "colA": "new value", "colB": 99 },
  "clientId": "tab-abc123"
}
```

| Field      | Type   | Notes |
|------------|--------|-------|
| `rowVer`   | number | Current version; server returns `409` if stale. |
| `values`   | object | Full values map for the row (not a partial patch). |
| `clientId` | string | Echoed by server in `RowUpdated` SignalR event. |

---

## Lock request body (POST /rows/:rowId/lock)

```json
{ "clientId": "tab-abc123" }
```

## Lock release body (DELETE /rows/:rowId/lock)

```json
{ "clientId": "tab-abc123" }
```

---

## ConflictDetected payload (SignalR → client)

```ts
interface ConflictDetectedPayload {
  rowId:        string;
  rowVer:       number;   // server's current version
  serverValues: Record<string, unknown>;
  clientValues: Record<string, unknown>;
  clientId:     string;   // which client caused the conflict
}
```

See [`services/auditor-grid-api/docs/signalr-events.md`](../../services/auditor-grid-api/docs/signalr-events.md)
for the full event catalogue.

---

## Change checklist

When adding or renaming a field in `normalize.js`, `client.js`, or
`handlers.js`, update this document to reflect:

- [ ] New canonical name added to the terminology table
- [ ] New / changed `Row` or `Column` interface field
- [ ] New server alias handled in `normalizeRows()` or `normalizeColumns()`
- [ ] New request body shape or field
- [ ] New or changed SignalR payload field
