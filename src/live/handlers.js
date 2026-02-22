// src/live/handlers.js
// Pure functions that apply each SignalR server-push event to a local rows
// array.  Extracted from component.js so they can be unit-tested without a DOM.
//
// Each function returns true when a matching row was found and mutated
// (caller can use the return value to decide whether to re-render).

/**
 * Applies a RowUpdated event to the local rows array.
 *
 * @param {object[]} rows
 * @param {{ rowId: string, rowVer: number, values: object, clientId: string }} payload
 * @returns {boolean}
 */
export function applyRowUpdated(rows, { rowId, rowVer, values }) {
  const idx = rows.findIndex(r => r.rowId === rowId);
  if (idx === -1) return false;
  rows[idx] = { ...rows[idx], rowVer, values };
  return true;
}

/**
 * Applies a RowLocked event to the local rows array.
 *
 * @param {object[]} rows
 * @param {{ rowId: string, userId: string, clientId: string }} payload
 * @returns {boolean}
 */
export function applyRowLocked(rows, { rowId, userId }) {
  const idx = rows.findIndex(r => r.rowId === rowId);
  if (idx === -1) return false;
  rows[idx] = { ...rows[idx], lockedBy: userId };
  return true;
}

/**
 * Applies a RowUnlocked event to the local rows array.
 *
 * @param {object[]} rows
 * @param {{ rowId: string }} payload
 * @returns {boolean}
 */
export function applyRowUnlocked(rows, { rowId }) {
  const idx = rows.findIndex(r => r.rowId === rowId);
  if (idx === -1) return false;
  rows[idx] = { ...rows[idx], lockedBy: null };
  return true;
}
