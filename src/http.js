function corsHeaders(extra = {}) {
  return {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": process.env.CORS_ALLOW_ORIGIN || "*",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization,x-ms-client-principal,x-ms-client-principal-id",
    ...extra
  };
}

function json(resBody, status = 200, extraHeaders = {}) {
  return { status, headers: corsHeaders(extraHeaders), body: JSON.stringify(resBody) };
}

async function readJson(request) {
  // Be tolerant of sendBeacon() / missing content-type: try reading text then JSON.parse.
  try {
    const raw = await request.text();
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function badRequest(message, detail) {
  return json({ ok: false, error: message, detail: detail ?? null }, 400);
}
function forbidden(message, detail) {
  return json({ ok: false, error: message, detail: detail ?? null }, 403);
}
function conflict(message, detail) {
  return json({ ok: false, error: message, detail: detail ?? null }, 409);
}
function serverError(message, detail) {
  return json({ ok: false, error: message, detail: detail ?? null }, 500);
}
function ok(body) { return json({ ok: true, ...body }, 200); }
function noContent() {
  return { status: 204, headers: { "access-control-allow-origin": process.env.CORS_ALLOW_ORIGIN || "*" } };
}

module.exports = { corsHeaders, json, readJson, badRequest, forbidden, conflict, serverError, ok, noContent };
