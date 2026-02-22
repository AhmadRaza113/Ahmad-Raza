# Grid Public API (`<sheet-grid>`)

## Purpose

This document defines the **public/stable host-facing contract** of the `sheet-grid` web component.

Anything documented here is considered host-consumable and should be treated as a contract for:
- current root host page (`index.html`)
- future portal app (`apps/portal`)
- test harnesses
- AI-assisted changes

If this contract changes, update:
1. this file
2. `docs/integration/grid-portal-contract.md`
3. manifests (`feature-to-files`, `dependency-map`, `docs-index`)
4. `CHANGELOG.md`

---

## Component Identity

- **Tag name:** `<sheet-grid>`
- **Type:** Custom Element (Web Component)
- **Registration:** `customElements.define("sheet-grid", SheetGrid)`
- **Shadow DOM:** `mode: "open"`

---

## Minimal Host Usage (Current)

```html
<sheet-grid id="grid"></sheet-grid>