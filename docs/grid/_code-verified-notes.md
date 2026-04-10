# Grid Collaboration — Code-Verified Notes

> **Purpose of this file**
> This is the single place where reviewers record facts they have *directly verified* in source code. Entries here take precedence over all other existing documentation (except the live source code itself). Every entry must cite the exact file and, where possible, the line range.
>
> **How to use**
> 1. Pick an unverified item from `collaboration-model.md` → "Needs Verification" table.
> 2. Read the relevant source file(s).
> 3. Record the verified fact in the matching section below.
> 4. Remove (or update) the corresponding row in the "Needs Verification" table in `collaboration-model.md`.
> 5. Commit both files together so the notes stay in sync with the doc.

---

## Status legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Verified in code |
| ❌ | Contradicted by code (doc was wrong) |
| ⚠️ | Partially verified / ambiguous |
| 🔲 | Not yet inspected |

---

## 1. Lock identity keys

**Status:** 🔲 Not yet inspected  
**File to inspect:** `src/api/locks-api.js`  
**Question:** What fields form the composite lock key (e.g., `gridId + rowId + columnId`)?

<!-- Fill in after reading src/api/locks-api.js:
**Verified fact:**
**Source:** `src/api/locks-api.js` line XX
-->

---

## 2. Lock TTL value and renewal interval

**Status:** 🔲 Not yet inspected  
**File to inspect:** `src/api/locks-api.js`  
**Question:** What is the TTL (seconds/ms)? Is there a renewal timer, and if so, what interval does it use?

<!-- Fill in after reading src/api/locks-api.js:
**Verified fact:**
**Source:** `src/api/locks-api.js` line XX
-->

---

## 3. Lock HTTP endpoints (acquire / renew / release)

**Status:** 🔲 Not yet inspected  
**File to inspect:** `src/api/locks-api.js`  
**Question:** What are the exact HTTP verb + URL patterns for each lock operation?

<!-- Example expected shape:
  acquire: POST /api/grids/{gridId}/locks
  renew:   PUT  /api/grids/{gridId}/locks/{lockId}
  release: DELETE /api/grids/{gridId}/locks/{lockId}
**Verified fact:**
**Source:** `src/api/locks-api.js` line XX
-->

---

## 4. Typing broadcast debounce interval

**Status:** 🔲 Not yet inspected  
**File to inspect:** `src/api/typing-api.js`  
**Question:** Is typing debounced before broadcast? If so, how many milliseconds?

<!-- Fill in after reading src/api/typing-api.js:
**Verified fact:**
**Source:** `src/api/typing-api.js` line XX
-->

---

## 5. Exact SignalR event names

**Status:** 🔲 Not yet inspected  
**File to inspect:** `src/live/handlers.js`  
**Question:** Confirm the exact string names used in `.on("…")` calls.

| Expected name | Confirmed? | Actual name (if different) | Source line |
|---------------|-----------|---------------------------|-------------|
| `gridPatch` | 🔲 | | |
| `gridRowAdded` | 🔲 | | |
| `gridRowsDeleted` | 🔲 | | |
| `gridLockChanged` | 🔲 | | |
| `gridTyping` | 🔲 | | |

---

## 6. `gridPatch` payload schema

**Status:** 🔲 Not yet inspected  
**File to inspect:** `src/live/handlers.js`  
**Question:** What fields does a `gridPatch` message carry (e.g., `rowId`, `columnId`, `value`, `rowVer`)?

<!-- Fill in after reading src/live/handlers.js:
**Verified fact:**
**Source:** `src/live/handlers.js` line XX
-->

---

## 7. Conflict HTTP status code and response payload

**Status:** 🔲 Not yet inspected  
**File to inspect:** `src/api/cells-api.js`  
**Question:** What HTTP status does the server return on a `rowVer` conflict (409? 412?)? What does the response body contain?

<!-- Fill in after reading src/api/cells-api.js:
**Verified fact:**
**Source:** `src/api/cells-api.js` line XX
-->

---

## 8. Conflict modal resolution choices and auto-close

**Status:** 🔲 Not yet inspected  
**File to inspect:** `src/ui/conflict-modal.js`  
**Question:** What buttons/choices does the modal show? Does it auto-close after a choice or require explicit dismissal?

<!-- Fill in after reading src/ui/conflict-modal.js:
**Verified fact:**
**Source:** `src/ui/conflict-modal.js` line XX
-->

---

## 9. Public `live` event names from `src/component.js`

**Status:** 🔲 Not yet inspected  
**File to inspect:** `src/component.js`  
**Question:** What event strings does the component emit or expose for connection state changes (e.g., `live:connected`, `live:disconnected`)?

<!-- Fill in after reading src/component.js:
**Verified fact:**
**Source:** `src/component.js` line XX
-->

---

## 10. Reconnect strategy in `src/live/connection.js`

**Status:** 🔲 Not yet inspected  
**File to inspect:** `src/live/connection.js`  
**Question:** Does it use `withAutomaticReconnect`? What back-off intervals are configured? Does it re-fetch grid state after reconnect?

<!-- Fill in after reading src/live/connection.js:
**Verified fact:**
**Source:** `src/live/connection.js` line XX
-->

---

## 11. Toast usage for connection / conflict UX

**Status:** 🔲 Not yet inspected  
**File to inspect:** `src/ui/toasts.js`  
**Question:** Is `toasts.js` called from `connection.js`, `handlers.js`, or `conflict-modal.js`? For what events?

<!-- Fill in after reading src/ui/toasts.js and its callers:
**Verified fact:**
**Source:** line XX
-->

---

## 12. Handling `gridPatch` during an active edit session

**Status:** 🔲 Not yet inspected  
**Files to inspect:** `src/live/handlers.js`, `src/editing/inline-editor.js`  
**Question:** When a `gridPatch` arrives for a row the local user is currently editing, does the frontend silently update `rowVer`, show a warning, or do nothing?

<!-- Fill in after reading both files:
**Verified fact:**
**Source:** line XX
-->

---

## 13. Lock auto-expiry peer notification

**Status:** 🔲 Not yet inspected  
**Files to inspect:** Backend hub source (if accessible), `src/live/handlers.js`  
**Question:** When a lock auto-expires server-side (TTL elapsed), does the backend broadcast `gridLockChanged` to peers so they remove the lock indicator?

<!-- Fill in after investigation:
**Verified fact:**
**Source:**
-->

---

## Miscellaneous verified notes

_Use this section for any code-verified facts that don't fit the categories above._

<!-- Example:
- ✅ `src/rendering/cell.js` uses a CSS class `cell--locked` to render the lock indicator. (line 42)
- ✅ Lock owner name is shown as a tooltip on the locked cell. (line 55)
-->

---

_Last updated: 2026-04-10. All items 🔲 until source files are present and reviewed._
