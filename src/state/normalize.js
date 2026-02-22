// src/state/normalize.js
// Converts raw server payloads into the canonical shapes used throughout the
// grid component.
//
// Canonical field names (source of truth — keep in sync with data-contracts.md):
//   Row    : rowId | rowVer | values | lockedBy
//   Column : colId | label  | type   | readonly
//   values : { [colId]: any }
//   clientId used in CellEdit and API bodies

/**
 * Normalizes an array of raw row objects from the API response.
 *
 * The server may use either `rowId` / `id` for the identifier and
 * either `rowVer` / `version` for the version counter.  Both aliases
 * are handled here so the rest of the component only deals with the
 * canonical names.
 *
 * @param {object[]} raw
 * @returns {{ rowId: string, rowVer: number, values: object, lockedBy: string|null }[]}
 */
export function normalizeRows(raw) {
  return (raw ?? []).map((r) => ({
    rowId:    String(r.rowId    ?? r.id      ?? ''),
    rowVer:   Number(r.rowVer   ?? r.version ?? 0),
    values:   r.values ?? {},
    lockedBy: r.lockedBy ?? null,
  }));
}

/**
 * Normalizes an array of raw column definitions from the API response.
 *
 * The server may use either `colId` / `id` for the identifier and
 * either `label` / `name` for the display name.
 *
 * @param {object[]} raw
 * @returns {{ colId: string, label: string, type: string, readonly: boolean }[]}
 */
export function normalizeColumns(raw) {
  return (raw ?? []).map((c) => ({
    colId:    String(c.colId ?? c.id   ?? ''),
    label:    c.label ?? c.name ?? c.colId ?? '',
    type:     c.type  ?? 'text',
    readonly: Boolean(c.readonly ?? false),
  }));
}
