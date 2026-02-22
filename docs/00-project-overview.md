# Project Overview

## Purpose

This repository contains the foundation of an **Auditor Request Tracker platform** being developed with AI assistance.

The platform has two major parts:

1. **Reusable real-time collaborative grid component** (`<sheet-grid>`)
   - spreadsheet-like editing UX (Excel-style)
   - live collaboration (locks, typing preview, save propagation)
   - conflict handling (`rowVer`)
2. **Portal application** (planned)
   - dashboard/admin/business workflows
   - embeds the grid component as one feature/screen

This repo also includes/plans backend services for the grid collaboration workflows:
- Azure Functions (REST API)
- Azure SignalR
- Azure Cache for Redis (cell locks)
- SQL Database (rows + concurrency/versioning)

---

## Current Project Status (as of this document)

### Grid edit component
- **Design/UI maturity:** ~80%
- **Functionality/backend maturity:** ~60%
- Working real-time collaborative grid exists and runs
- Backend currently supports only the endpoints needed for the grid editing feature

### Portal template (overall look/layout)
- **Template design maturity:** ~90%
- **Backend/database for portal features:** mostly pending
- Previous portal exists as a **single-file HTML/CSS/JS POC** (localStorage-based demo), but not yet integrated as the real production portal in this repo

### Database status
- Only the table(s) needed for the current grid editing feature are created
- Remaining portal/business tables are pending

---

## High-Level Architecture

## A) Grid Component (`<sheet-grid>`) — Reusable Package (Current live code at repo root)

**Role:** Reusable spreadsheet-like collaborative grid engine used by host pages/apps.

### Current implementation characteristics
- Vanilla JavaScript (ES Modules)
- Custom Element: `customElements.define("sheet-grid", SheetGrid)`
- Shadow DOM (`mode: "open"`)
- No framework / no bundler
- ~40 ES module files organized by subsystem (`src/*` folders)
- Methods mixed into `SheetGrid.prototype` via `Object.assign(...)`

### Core capabilities (current as-built)
- Inline editing
- Keyboard/mouse navigation
- Clipboard copy/paste (TSV)
- Fill handle (drag-to-fill)
- Column reorder/resize/visibility
- Filters and sorting
- Virtual scrolling (variable heights)
- Real-time collaboration:
  - Redis-backed cell locks (TTL + renewal)
  - Typing previews with user name
  - Live save propagation via SignalR
  - Conflict detection/resolution using `rowVer`

---

## B) Portal App (Host Application) — Planned

**Role:** Auditor Request Tracker business application that will embed the grid component.

### Current status
- Existing **single-file POC** (HTML/CSS/Vanilla JS) documented separately
- POC includes dashboard/admin/localStorage data, but is not yet the real modular app in this repo
- `apps/portal/` scaffold exists but is currently empty

### Planned direction
- Modular portal implementation under `apps/portal/`
- Grid embedded as one feature/screen
- Clear contract between portal business logic and grid engine

---

## C) Backend / Live Services (Current grid support only)

### Implemented for grid feature (current)
- Azure Functions endpoints for:
  - rows load / batch cell save / add row / delete rows
  - locks acquire / renew / release
  - typing broadcast
  - SignalR negotiation
- Azure SignalR hub: `auditorgrid`
- Redis lock management (cell-level locks)
- SQL persistence with row version/concurrency support (`rowVer` contract in API)

### Not yet complete (overall platform)
- Full portal/business backend
- Remaining database tables
- Expanded portal API surface beyond grid feature

---

## Current Repo Reality (Important)

### Live/working code is currently at repo root
```text
/workspaces/Ahmad-Raza/
├── index.html
├── sheet-grid.js
├── src/
│   ├── component.js
│   ├── api/
│   ├── live/
│   ├── state/
│   ├── rendering/
│   ├── editing/
│   ├── interaction/
│   ├── virtualization/
│   ├── ui/
│   ├── actions/
│   ├── config/
│   ├── utils/
│   └── styles/