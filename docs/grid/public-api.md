# Sheet Grid — Public API

> **Source of truth**: [`src/component.js`](../../src/component.js),
> [`src/api/client.js`](../../src/api/client.js),
> [`src/api/endpoints.js`](../../src/api/endpoints.js).
> This document must be updated whenever those files change.

---

## Custom element

```html
<sheet-grid
  api-base="https://api.example.com"
  client-id="tab-abc123"
  user-id="user-42"
  storage-key="my-grid"
></sheet-grid>
```

Register the element by loading `sheet-grid.js` as a module **after** the
`@microsoft/signalr` CDN script:

```html
<script src="https://cdn.jsdelivr.net/npm/@microsoft/signalr@8/dist/browser/signalr.min.js"></script>
<script type="module" src="sheet-grid.js"></script>
```

---

## Observed attributes

All five attributes are read on `connectedCallback` and on every
`attributeChangedCallback`.  Changing any attribute while the element is
connected triggers a full re-boot (new `ApiClient` + new `GridHub`).

| Attribute     | Type    | Required | Description |
|---------------|---------|----------|-------------|
| `api-base`    | string  | yes      | Base URL for all REST calls.  No trailing slash.  Example: `https://api.example.com` |
| `client-id`   | string  | yes      | Opaque identifier for this browser tab / session.  Included as `clientId` in every write body and as `X-Client-Id` request header. |
| `user-id`     | string  | yes      | Authenticated user identifier.  Sent as `X-User-Id` header to the SignalR hub.  Not sent in REST request bodies. |
| `storage-key` | string  | no       | `localStorage` key used to persist lightweight UI state between page loads. |
| `readonly`    | boolean | no       | Presence attribute (`readonly` / no value).  When present, all editing is disabled.  Cells render without `tabindex`, `InlineEditor` is not attached. |

---

## Events emitted

Both events bubble and are `composed` (they cross shadow DOM boundaries).

### `live`

Fired when the SignalR connection state changes.

```js
element.addEventListener('live', (ev) => {
  const { connected, reason } = ev.detail;
  // connected : boolean   — true = connected, false = disconnected
  // reason    : string?   — present only when connected === false
});
```

| `ev.detail` field | Type    | Notes |
|--------------------|---------|-------|
| `connected`        | boolean | `true` after `HubConnection.start()` resolves or after `onreconnected`. |
| `reason`           | string  | Present only when `connected` is `false`.  Value is the error message from SignalR. |

### `toast`

Fired to surface a notification to the host application.

```js
element.addEventListener('toast', (ev) => {
  const { message, level } = ev.detail;
  // message : string              — human-readable description
  // level   : 'info'|'warn'|'error'
});
```

| `ev.detail` field | Type                        | Notes |
|--------------------|----------------------------|-------|
| `message`          | string                      | Human-readable message. |
| `level`            | `'info'` \| `'warn'` \| `'error'` | Severity. |

---

## REST endpoints

All paths are relative to `api-base`.  Full references in
[`src/api/endpoints.js`](../../src/api/endpoints.js) and
[`src/api/client.js`](../../src/api/client.js).

| Method   | Path                    | Description |
|----------|-------------------------|-------------|
| `GET`    | `/rows`                 | Fetch all rows (paginated). |
| `GET`    | `/rows/:rowId`          | Fetch a single row. |
| `PUT`    | `/rows/:rowId`          | Update a row (optimistic concurrency via `rowVer`). |
| `POST`   | `/rows/:rowId/lock`     | Acquire an edit lock. |
| `DELETE` | `/rows/:rowId/lock`     | Release an edit lock. |
| `GET`    | `/columns`              | Fetch column definitions. |

> **Needs verification**: query parameters for `GET /rows` pagination are not
> yet confirmed from the backend implementation.

---

## Request headers

| Header        | Value            | Applies to |
|---------------|------------------|------------|
| `Content-Type`| `application/json` | All requests with a body |
| `X-Client-Id` | `client-id` value  | All requests |
| `X-User-Id`   | `user-id` value    | SignalR hub connection only |

---

## Change checklist

When updating `src/component.js`, `src/api/client.js`, or
`src/api/endpoints.js`, update this document to reflect:

- [ ] Any new or renamed attribute in `observedAttributes`
- [ ] Any new or renamed `CustomEvent` type string (`live`, `toast`)
- [ ] Any change to `ev.detail` shape
- [ ] Any added / removed REST endpoint
- [ ] Any change to request headers
