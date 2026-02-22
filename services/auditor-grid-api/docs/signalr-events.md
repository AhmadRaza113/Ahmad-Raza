
---

# 5) `services/auditor-grid-api/docs/signalr-events.md`

```markdown
# Auditor Grid API — SignalR Events

## Purpose

Defines the Azure SignalR hub and event contracts used by the grid’s real-time collaboration features.

This document is backend-oriented but written to stay aligned with frontend consumers:
- `src/live/connection.js`
- `src/live/handlers.js`
- `docs/grid/collaboration-model.md`

---

## Status

- **Current usage:** Active for grid collaboration feature
- **Backend scope:** Grid feature only (portal-wide backend not completed yet)
- **Hub name:** `auditorgrid`

---

## SignalR Overview (Current)

The grid uses Azure SignalR for server → client live updates related to:
- saved cell patches
- row add/delete events
- lock state changes
- typing previews

SignalR connection is established after negotiation through Azure Functions.

---

## Negotiate Endpoint

### Route
```http
POST /api/negotiate?clientId={n}&userId={u}