# Grid ↔ Portal Integration Contract

## Purpose

This document defines the integration contract between:

- **Portal App** (future Auditor Request Tracker host app)
- **`<sheet-grid>` component** (current real-time collaborative spreadsheet-like grid)

This contract exists to prevent:
- unclear ownership,
- data shape mismatches,
- business logic leaking into grid core,
- and breakage during AI-assisted changes.

---

## Status

- **Current status:** Starter contract with verified current grid public surface
- **Maturity:** Partial (portal side mostly planned)
- **Last verified scope:** `<sheet-grid>` usage in current root `index.html` + grid backend endpoints/events provided by current implementation notes

---

## Current Integration Reality (Before Portal Exists)

Right now, the grid is hosted directly by a simple root `index.html` test/host page:

```html
<sheet-grid id="grid"></sheet-grid>