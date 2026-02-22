/**
 * Base HTTP API client — wraps fetch for the Azure Functions backend.
 */
export const apiClientMethods = {
  async _api(path, { method = "GET", body = null } = {}) {
    if (!this.apiBase) throw new Error("Missing api-base on <sheet-grid>.");
    const url = `${this.apiBase}${path}`;
    const headers = { "Accept": "application/json" };
    let payload = undefined;
    if (body != null) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
    const res = await fetch(url, { method, headers, body: payload, credentials: "omit" });
    const txt = await res.text();
    let json = null;
    try { json = txt ? JSON.parse(txt) : null; } catch { json = { ok: false, raw: txt }; }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}: ${txt}`);
    return json;
  },
};
