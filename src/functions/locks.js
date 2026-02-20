const { app } = require("@azure/functions");
const { readJson, badRequest, forbidden, ok, noContent } = require("../http");
const { acquire, renew, release } = require("../lock");
const { signalROutput } = require("../signalrBindings");

function parseIntStrict(v) {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}
function str(v, fallback = null) {
  return (v == null) ? fallback : String(v);
}
function ttlFromBody(body) {
  const n = Number(body?.ttlSeconds);
  return Number.isFinite(n) && n >= 5 && n <= 300 ? Math.floor(n) : 30; // default 30s
}
function requireUserId(body) {
  const userId = str(body?.userId);
  return userId && userId.length <= 200 ? userId : null;
}

function broadcastLock(context, clientId, payload) {
  context.extraOutputs.set(signalROutput, {
    target: "gridLockChanged",
    arguments: [payload],
    groupName: `client:${clientId}`
  });
}

app.http("locks_acquire", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "locks/acquire",
  extraOutputs: [signalROutput],
  handler: async (request, context) => {
    if (request.method === "OPTIONS") return noContent();

    const body = await readJson(request);
    if (!body) return badRequest("Invalid JSON body");

    const clientId = parseIntStrict(body.clientId);
    const rowId = str(body.rowId);
    const colId = str(body.colId);
    const userId = requireUserId(body);
    const ttlSeconds = ttlFromBody(body);

    if (clientId == null) return badRequest("clientId is required and must be an integer");
    if (!rowId || !colId) return badRequest("rowId and colId are required");
    if (!userId) return badRequest("userId is required");

    const res = await acquire({ clientId, rowId, colId, userId, ttlSeconds });

    if (res.acquired) {
      broadcastLock(context, clientId, {
        clientId, rowId, colId,
        locked: true,
        userId,
        ttlSeconds,
        atUtc: new Date().toISOString()
      });
    }

    return ok({ ...res });
  }
});

app.http("locks_renew", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "locks/renew",
  extraOutputs: [signalROutput],
  handler: async (request, context) => {
    if (request.method === "OPTIONS") return noContent();

    const body = await readJson(request);
    if (!body) return badRequest("Invalid JSON body");

    const clientId = parseIntStrict(body.clientId);
    const rowId = str(body.rowId);
    const colId = str(body.colId);
    const userId = requireUserId(body);
    const ttlSeconds = ttlFromBody(body);

    if (clientId == null) return badRequest("clientId is required and must be an integer");
    if (!rowId || !colId) return badRequest("rowId and colId are required");
    if (!userId) return badRequest("userId is required");

    const res = await renew({ clientId, rowId, colId, userId, ttlSeconds });
    // optional: broadcast renew? usually not needed
    return ok({ ...res });
  }
});

app.http("locks_release", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "locks/release",
  extraOutputs: [signalROutput],
  handler: async (request, context) => {
    if (request.method === "OPTIONS") return noContent();

    const body = await readJson(request);
    if (!body) return badRequest("Invalid JSON body");

    const clientId = parseIntStrict(body.clientId);
    const rowId = str(body.rowId);
    const colId = str(body.colId);
    const userId = requireUserId(body);

    if (clientId == null) return badRequest("clientId is required and must be an integer");
    if (!rowId || !colId) return badRequest("rowId and colId are required");
    if (!userId) return badRequest("userId is required");

    const res = await release({ clientId, rowId, colId, userId });

    if (res.released) {
      broadcastLock(context, clientId, {
        clientId, rowId, colId,
        locked: false,
        userId,
        atUtc: new Date().toISOString()
      });
    }

    return ok({ ...res });
  }
});
