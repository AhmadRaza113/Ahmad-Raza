/**
 * Display formatting helpers (initials, filter keys, cell value formatting).
 */

import { isBlank } from './helpers.js';
import { toDatetimeLocalValue } from './datetime.js';

/** Generate 2-letter initials from a userId string like "ali.raza@live" → "AR" */
export function initialsFromUserId(userId) {
  const s = String(userId || "").trim();
  if (!s) return "•";
  const base = s.split("@")[0] || s;
  const parts = base.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

/**
 * Extract a readable display name from a userId.
 * "ali.raza@domain.com" → "Ali Raza"
 * "anonymous@web"       → "Anonymous"
 * "JohnDoe"             → "Johndoe"
 */
export function displayNameFromUserId(userId) {
  const s = String(userId || "").trim();
  if (!s) return "Unknown";
  const base = s.split("@")[0] || s;
  const parts = base.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  return parts
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ") || s;
}

/** Stable key for filter value-list (blanks → "__BLANK__") */
export function valueKeyForFilter(v) {
  if (isBlank(v)) return "__BLANK__";
  return String(v);
}

/** Human label for a filter key */
export function valueLabelForFilterKey(k) {
  return k === "__BLANK__" ? "(Blanks)" : k;
}

/** Format a cell value for display based on column type */
export function formatValue(col, value) {
  if (value == null) return "";
  if (col.type === "datetime") return toDatetimeLocalValue(value);
  if (col.type === "number") return (value === "" ? "" : String(value));
  return String(value);
}
