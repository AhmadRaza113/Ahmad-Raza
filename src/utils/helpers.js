/**
 * General-purpose helper functions (no DOM dependency).
 */

export function uid() {
  return (crypto.randomUUID?.() ?? (Math.random().toString(16).slice(2) + Date.now().toString(16)));
}

export function debounce(fn, ms = 400) {
  let t;
  const wrapper = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  // Cancel any pending invocation without calling fn.
  wrapper.cancel = () => { clearTimeout(t); t = null; };
  return wrapper;
}

export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function isBlank(v) {
  return v === null || v === undefined || String(v).trim() === "";
}

export function containsCI(hay, needle) {
  return String(hay ?? "").toLowerCase().includes(String(needle ?? "").toLowerCase());
}

export function startsCI(hay, needle) {
  return String(hay ?? "").toLowerCase().startsWith(String(needle ?? "").toLowerCase());
}

export function equalsCI(a, b) {
  return String(a ?? "").toLowerCase() === String(b ?? "").toLowerCase();
}
