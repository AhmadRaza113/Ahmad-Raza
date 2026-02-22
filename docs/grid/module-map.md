
---

# 4) `docs/grid/module-map.md`

```markdown
# Grid Module Map

## Purpose

Maps the current grid component codebase by folder/module responsibility so AI (and humans) can quickly load the right context before making changes.

This is a **routing/ownership map**, not a strict import graph.

---

## Current Reality (Important)

### Canonical live grid code is currently at repo root
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