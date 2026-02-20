const { app } = require("@azure/functions");
const { readJson, badRequest, ok, noContent } = require("../http");
const { signalROutput } = require("../signalrBindings");

function parseIntStrict(v) {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}
function str(v, fallback = null) {
  return (v == null) ? fallback : String(v);
}
function requireUserId(body) {
  const userId = str(body?.userId);
  return userId && userId.length <= 200 ? userId : null;
}
function isTypingEnd(body) {
  // Accept a few shapes so frontend can send either:
  // { ended:true } or { isEnd:true } or { action:"end" } or { value:null }
  if (!body) return false;
  if (body.ended === true || body.isEnd === true) return true;
  const action = (body.action || body.kind || "").toString().toLowerCase();
  if (action === "end" || action === "stop" || action === "typing_end") return true;
  if (body.value === null) return true;
  return false;
}

/**
 * POST /api/typing
 * body:
 * {
 *   clientId: 123,
 *   rowId: "guid",
 *   colId: "auditor_request",
 *   userId: "user@x.com",
 *   value: "partial text",          // optional
 *   ended: false | true             // optional
 * }
 *
 * This is a lightweight relay: NO DB writes, just broadcasts to SignalR.
 */
app.http("typing", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "typing",
  extraOutputs: [signalROutput],
  handler: async (request, context) => {
    if (request.method === "OPTIONS") return noContent();

    const body = await readJson(request);
    if (!body) return badRequest("Invalid JSON body");

    const clientId = parseIntStrict(body.clientId);
    const rowId = str(body.rowId);
    const colId = str(body.colId);
    const userId = requireUserId(body);
    const ended = isTypingEnd(body);

    if (clientId == null) return badRequest("clientId is required and must be an integer");
    if (!rowId || !colId) return badRequest("rowId and colId are required");
    if (!userId) return badRequest("userId is required");

    const value = ended ? null : (body.value == null ? "" : String(body.value));

    context.extraOutputs.set(signalROutput, {
      target: "gridTyping",
      arguments: [{
        clientId,
        rowId,
        colId,
        userId,
        value,
        ended,
        atUtc: new Date().toISOString()
      }],
      groupName: `client:${clientId}`
    });

    return ok({ relayed: true, ended });
  }
});
