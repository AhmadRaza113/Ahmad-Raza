/**
 * Datetime parsing/normalization for datetime-local inputs.
 */

/** Convert any date-ish value to "YYYY-MM-DDTHH:mm" for <input type="datetime-local"> */
export function toDatetimeLocalValue(v) {
  if (!v) return "";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s.slice(0, 16);
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(s)) return s.replace(/\s+/, "T").slice(0, 16);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00`;
  return "";
}

/** Normalize a datetime-local string to exactly "YYYY-MM-DDTHH:mm" */
export function normalizeDatetimeLocalValue(v) {
  if (!v) return "";
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s)) return s.slice(0, 16);
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(s)) return s.replace(/\s+/, "T").slice(0, 16);
  return toDatetimeLocalValue(s);
}
