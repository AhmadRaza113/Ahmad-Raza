const { createClient } = require("redis");

let redisClient = null;

/**
 * Get or recreate Redis connection safely (Azure Functions compatible)
 */
async function getRedis() {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  const host = process.env.REDIS_HOST;
  const password = process.env.REDIS_PASSWORD;

  if (!host) throw new Error("Missing REDIS_HOST setting");
  if (!password) throw new Error("Missing REDIS_PASSWORD setting");

  redisClient = createClient({
    socket: {
      host: host,
      port: 6380,
      tls: true,
      connectTimeout: 10000,
      keepAlive: 5000,
      reconnectStrategy: (retries) => {
        if (retries > 5) return new Error("Redis reconnect failed");
        return 2000; // retry after 2s
      }
    },
    username: "default", // required for Azure Redis 6+
    password: password
  });

  redisClient.on("error", (err) => {
    console.error("Redis error:", err);
  });

  redisClient.on("end", () => {
    console.log("Redis connection closed");
  });

  await redisClient.connect();
  console.log("Redis connected successfully");

  return redisClient;
}

function lockKey(clientId, rowId, colId) {
  return `lock:${clientId}:${rowId}:${colId}`;
}

function nowIso() {
  return new Date().toISOString();
}

/**
 * Acquire lock using SET NX EX.
 */
async function acquire({ clientId, rowId, colId, userId, ttlSeconds }) {
  const redis = await getRedis();
  const key = lockKey(clientId, rowId, colId);

  const value = JSON.stringify({
    userId,
    acquiredAtUtc: nowIso(),
    ttlSeconds
  });

  const ok = await redis.set(key, value, { NX: true, EX: ttlSeconds });

  if (ok) {
    return { acquired: true };
  }

  const cur = await redis.get(key);
  return { acquired: false, holder: cur ? safeParse(cur) : null };
}

/**
 * Renew lock if owned by userId (atomic Lua).
 */
async function renew({ clientId, rowId, colId, userId, ttlSeconds }) {
  const redis = await getRedis();
  const key = lockKey(clientId, rowId, colId);

  const lua = `
local key = KEYS[1]
local userId = ARGV[1]
local ttl = tonumber(ARGV[2])
local cur = redis.call("GET", key)
if not cur then return 0 end
local ok, obj = pcall(cjson.decode, cur)
if not ok then return 0 end
if obj["userId"] ~= userId then return 0 end
obj["ttlSeconds"] = ttl
redis.call("SET", key, cjson.encode(obj), "EX", ttl)
return 1
`;

  const res = await redis.eval(lua, {
    keys: [key],
    arguments: [String(userId), String(ttlSeconds)]
  });

  if (res === 1) {
    return { renewed: true };
  }

  const cur = await redis.get(key);
  return { renewed: false, holder: cur ? safeParse(cur) : null };
}

/**
 * Release lock if owned by userId (atomic Lua).
 */
async function release({ clientId, rowId, colId, userId }) {
  const redis = await getRedis();
  const key = lockKey(clientId, rowId, colId);

  const lua = `
local key = KEYS[1]
local userId = ARGV[1]
local cur = redis.call("GET", key)
if not cur then return 0 end
local ok, obj = pcall(cjson.decode, cur)
if not ok then return 0 end
if obj["userId"] ~= userId then return 0 end
redis.call("DEL", key)
return 1
`;

  const res = await redis.eval(lua, {
    keys: [key],
    arguments: [String(userId)]
  });

  if (res === 1) {
    return { released: true };
  }

  const cur = await redis.get(key);
  return { released: false, holder: cur ? safeParse(cur) : null };
}

async function check({ clientId, rowId, colId }) {
  const redis = await getRedis();
  const key = lockKey(clientId, rowId, colId);
  const cur = await redis.get(key);
  return cur ? safeParse(cur) : null;
}

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}


function tryParseLockKey(key) {
  // expected: lock:{clientId}:{rowId}:{colId}
  if (!key || typeof key !== "string") return null;
  const parts = key.split(":");
  if (parts.length < 4) return null;
  if (parts[0] !== "lock") return null;
  const clientId = Number(parts[1]);
  if (!Number.isInteger(clientId)) return null;
  const rowId = parts[2];
  const colId = parts.slice(3).join(":"); // in case colId contains ':', stay safe
  return { clientId, rowId, colId };
}

/**
 * Best-effort cleanup: release ALL locks owned by this userId across all clients.
 * Used by SignalR "disconnected" handler to prevent orphaned locks.
 */
async function releaseAllForUser(userId) {
  const redis = await getRedis();
  const released = [];

  // scanIterator is non-blocking; COUNT is a hint.
  for await (const key of redis.scanIterator({ MATCH: "lock:*", COUNT: 200 })) {
    const cur = await redis.get(key);
    if (!cur) continue;
    const obj = safeParse(cur);
    if (!obj || obj.userId !== userId) continue;

    const parsed = tryParseLockKey(key);
    if (!parsed) continue;

    // Delete (even if already expired between GET and DEL)
    await redis.del(key);
    released.push(parsed);
  }

  return released;
}

module.exports = {
  acquire,
  renew,
  release,
  check,

  releaseAllForUser,
  tryParseLockKey
};
