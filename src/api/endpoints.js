// src/api/endpoints.js
// Central reference for every REST path consumed by the grid component.
// Paths are relative to the value of the `api-base` attribute.
//
// Source of truth: this file. docs/grid/public-api.md and
// docs/grid/data-contracts.md must reflect these paths exactly.

export const ENDPOINTS = {
  /** GET  /rows              — paginated row list        */
  rows:      '/rows',

  /** GET  /rows/:rowId       — single row                */
  row:       (rowId) => `/rows/${encodeURIComponent(rowId)}`,

  /** PUT  /rows/:rowId       — update row (optimistic)   */
  rowUpdate: (rowId) => `/rows/${encodeURIComponent(rowId)}`,

  /** POST   /rows/:rowId/lock — acquire edit lock         */
  rowLock:   (rowId) => `/rows/${encodeURIComponent(rowId)}/lock`,

  /** DELETE /rows/:rowId/lock — release edit lock         */
  rowUnlock: (rowId) => `/rows/${encodeURIComponent(rowId)}/lock`,

  /** GET  /columns           — column definitions        */
  columns:   '/columns',
};
