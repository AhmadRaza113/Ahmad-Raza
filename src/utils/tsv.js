/**
 * TSV (Tab-Separated Values) serialization for clipboard copy/paste.
 */

export function toTSV(matrix) {
  return matrix.map(row => row.map(v => (v ?? "")).join("\t")).join("\n");
}

export function parseTSV(text) {
  return text.replace(/\r/g, "").split("\n").map(r => r.split("\t"));
}
