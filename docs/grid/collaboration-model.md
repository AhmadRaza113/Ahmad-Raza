
---

# 3) `docs/grid/collaboration-model.md`

```markdown
# Grid Collaboration Model

## Purpose

Defines how real-time collaboration works in the grid, including:
- SignalR connection lifecycle
- cell locking (Redis)
- typing preview
- save propagation
- conflict detection and resolution

This is the behavior-level contract tying together:
- `src/api/*`
- `src/live/*`
- `src/editing/*`
- `src/rendering/cell.js`
- `src/ui/conflict-modal.js`

---

## Summary (Current As-Built Behavior)

The grid provides an Excel-like collaborative experience where multiple users can edit the same dataset simultaneously.

### Key collaboration behaviors
- **Cell-level locking** (Redis-backed) prevents most simultaneous edit collisions
- **Typing preview** shows in-progress text from another user
- **Live save propagation** pushes saved values to other users via SignalR
- **Conflict detection** catches stale saves using `rowVer`
- **Conflict modal** lets user choose how to resolve collisions

---

## Collaboration Components (Current)

## Frontend
- `src/api/locks-api.js` — acquire/renew/release lock calls
- `src/api/typing-api.js` — typing broadcast calls
- `src/api/cells-api.js` — save/batch operations + conflict parsing
- `src/live/connection.js` — SignalR connect/reconnect lifecycle
- `src/live/handlers.js` — inbound event application
- `src/rendering/cell.js` — lock/typing visuals
- `src/ui/conflict-modal.js` — conflict resolution UI

## Backend services
- Azure Functions (REST + negotiate)
- Azure SignalR (`auditorgrid`)
- Redis (lock storage with TTL)
- SQL database (rows + concurrency token/`rowVer` semantics)

---

## Core Collaboration Concepts

## 1) Cell Lock

A temporary ownership marker for a specific cell:
- key dimensions: `clientId + rowId + colId`
- owner: `userId`
- TTL-based (current documented value ~30s)

Purpose:
- reduce edit collisions
- show other users who is editing
- improve UX before save-time conflict detection

Locking is an **advisory/preventive** mechanism. Final correctness still relies on save-time concurrency (`rowVer`).

---

## 2) Typing Preview

Transient preview text broadcast while a user is editing a cell.

Purpose:
- show live intent before save
- reduce confusion in collaborative editing
- display editor identity (user name/id)

Typing preview is **not persisted** as a final saved value.

---

## 3) Live Patch

When a user saves a cell, server broadcasts a patch event to other connected users:
- row ID
- column ID
- new value
- new `rowVer`
- update metadata (`updatedAt`, `updatedBy`)

This allows other users to see saved changes without manual refresh.

---

## 4) Conflict

A save conflict happens when a user submits a cell update with a stale `baseRowVer` (i.e., another save already changed the row).

Server returns conflict info instead of applying the update.

Frontend then shows conflict UI (e.g. Keep Mine / Accept Server).

---

## End-to-End Collaboration Flow (Typical Edit)

## Happy path: edit + lock + typing + save + release

1. User selects editable cell
2. Grid attempts lock acquire (`/api/locks/acquire`)
3. If acquired:
   - user can edit
   - lock visuals may appear to others
4. While typing:
   - grid sends typing payloads (`/api/typing`)
   - others receive `gridTyping`
5. User saves:
   - grid sends batch update with `baseRowVer`
6. Backend updates DB and emits `gridPatch`
7. All clients apply saved value and new `rowVer`
8. Grid clears typing preview
9. Grid releases lock (`/api/locks/release`) (or lock expires if release fails)

---

## Locking Model (Redis)

## Lock identity
Locks are scoped by:
- `clientId`
- `rowId`
- `colId`

This means different cells in the same row can theoretically be independently locked (subject to UI policy).

---

## Lock acquire

### Request
```json
{
  "clientId": 1,
  "rowId": "row-abc-123",
  "colId": "status",
  "userId": "ali@live",
  "ttlSeconds": 30
}