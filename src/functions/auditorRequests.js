const { app } = require("@azure/functions");
const { v4: uuidv4 } = require("uuid");
const { sql, getPool } = require("../db");
const { COL_MAP, SELECT_SQL, toGridRow } = require("../mapping");
const { readJson, badRequest, serverError, ok, noContent } = require("../http");
const { check: checkLock } = require("../lock");
const { signalROutput } = require("../signalrBindings");

function parseIntStrict(v) {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

function parseRowVerBase64(v) {
  if (!v || typeof v !== "string") return null;
  try {
    const b = Buffer.from(v, "base64");
    if (b.length !== 8) return null; // rowversion is 8 bytes
    return b;
  } catch {
    return null;
  }
}

function str(v, fallback = null) {
  return (v == null) ? fallback : String(v);
}

function broadcast(context, clientId, target, payload) {
  context.extraOutputs.set(signalROutput, {
    target,
    arguments: [payload],
    groupName: `client:${clientId}`
  });
}

/**
 * GET /api/auditorRequests?clientId=123
 */
app.http("auditorRequests_get", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "auditorRequests",
  handler: async (request, context) => {
    if (request.method === "OPTIONS") return noContent();

    const clientId = parseIntStrict(new URL(request.url).searchParams.get("clientId"));
    if (clientId == null) return badRequest("clientId is required and must be an integer");

    try {
      const pool = await getPool();
      const rs = await pool.request()
        .input("clientId", sql.Int, clientId)
        .query(SELECT_SQL);

      const rows = (rs.recordset || []).map(toGridRow);
      return ok({ clientId, rows, serverUtc: new Date().toISOString() });
    } catch (e) {
      context.log("GET auditorRequests failed:", e);
      return serverError("Failed to load rows");
    }
  }
});

/**
 * POST /api/auditorRequests/rows
 * body: { clientId, byUser?, values? }
 */
app.http("auditorRequests_addRow", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "auditorRequests/rows",
  extraOutputs: [signalROutput],
  handler: async (request, context) => {
    if (request.method === "OPTIONS") return noContent();

    const body = await readJson(request);
    if (!body) return badRequest("Invalid JSON body");

    const clientId = parseIntStrict(body.clientId);
    if (clientId == null) return badRequest("clientId is required and must be an integer");

    const byUser = str(body.byUser);
    const rowId = uuidv4();

    // Optional initial values (only for editable columns)
    const values = body.values && typeof body.values === "object" ? body.values : {};
    const init = {};
    for (const [colId, sqlCol] of Object.entries(COL_MAP)) {
      init[sqlCol] = values[colId] != null ? String(values[colId]) : null;
    }

    try {
      const pool = await getPool();
      const tx = new sql.Transaction(pool);
      await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);

      try {
        const req = new sql.Request(tx);
        req.input("RowId", sql.UniqueIdentifier, rowId);
        req.input("ClientId", sql.Int, clientId);
        req.input("UpdatedBy", sql.NVarChar(200), byUser);

        for (const [sqlCol, val] of Object.entries(init)) {
          req.input(sqlCol, sql.NVarChar(sql.MAX), val);
        }

        const insertSql = `
          INSERT INTO dbo.AuditorRequests
            (RowId, ClientId, AuditorRequest, HostComments, HostBackroomComments, AssignedTo, Status, RequestedDepartment, RequestType, UpdatedBy)
          VALUES
            (@RowId, @ClientId, @AuditorRequest, @HostComments, @HostBackroomComments, @AssignedTo, @Status, @RequestedDepartment, @RequestType, @UpdatedBy);

          INSERT INTO dbo.AuditorRequestEvents
            (ClientId, RowId, ColId, OldValue, NewValue, Action, ByUser)
          VALUES
            (@ClientId, @RowId, NULL, NULL, NULL, 'row_add', @UpdatedBy);

          SELECT TOP 1 * FROM dbo.AuditorRequests WHERE RowId=@RowId AND ClientId=@ClientId;
        `;

        const rs = await req.query(insertSql);
        await tx.commit();

        const inserted = rs.recordsets?.[2]?.[0] || rs.recordset?.[0];
        const row = toGridRow(inserted);

        broadcast(context, clientId, "gridRowAdded", { row, byUser, atUtc: new Date().toISOString() });
        return ok({ row });
      } catch (inner) {
        await tx.rollback();
        throw inner;
      }
    } catch (e) {
      context.log("POST addRow failed:", e);
      return serverError("Failed to add row");
    }
  }
});

/**
 * POST /api/auditorRequests/rows/delete
 * body: { clientId, rowIds: [guid...], byUser? }
 *
 * NOTE: We use POST (instead of DELETE) to avoid route conflicts and to make
 * "body with list of ids" testing easier in common HTTP clients.
 */
app.http("auditorRequests_deleteRows", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "auditorRequests/rows/delete",
  extraOutputs: [signalROutput],
  handler: async (request, context) => {
    if (request.method === "OPTIONS") return noContent();

    const body = await readJson(request);
    if (!body) return badRequest("Invalid JSON body");

    const clientId = parseIntStrict(body.clientId);
    if (clientId == null) return badRequest("clientId is required and must be an integer");

    const rowIds = Array.isArray(body.rowIds) ? body.rowIds.map(String) : [];
    if (!rowIds.length) return badRequest("rowIds[] is required");

    const byUser = str(body.byUser);

    try {
      const pool = await getPool();
      const tx = new sql.Transaction(pool);
      await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);

      try {
        for (let i = 0; i < rowIds.length; i += 50) {
          const chunk = rowIds.slice(i, i + 50);

          const req = new sql.Request(tx);
          req.input("ClientId", sql.Int, clientId);
          req.input("ByUser", sql.NVarChar(200), byUser);

          const inParams = chunk.map((id, idx) => {
            req.input(`RowId${idx}`, sql.UniqueIdentifier, id);
            return `@RowId${idx}`;
          }).join(",");

          const q = `
            DELETE FROM dbo.AuditorRequests
            WHERE ClientId=@ClientId AND RowId IN (${inParams});

            ${chunk.map((_, idx) => `
              INSERT INTO dbo.AuditorRequestEvents (ClientId, RowId, ColId, OldValue, NewValue, Action, ByUser)
              VALUES (@ClientId, @RowId${idx}, NULL, NULL, NULL, 'row_delete', @ByUser);
            `).join("\n")}
          `;
          await req.query(q);
        }

        await tx.commit();
        broadcast(context, clientId, "gridRowsDeleted", { rowIds, byUser, atUtc: new Date().toISOString() });
        return ok({ deleted: rowIds.length });
      } catch (inner) {
        await tx.rollback();
        throw inner;
      }
    } catch (e) {
      context.log("POST deleteRows failed:", e);
      return serverError("Failed to delete rows");
    }
  }
});

/**
 * POST /api/auditorRequests/batch
 * body:
 * {
 *   clientId: 123,
 *   byUser: "user@x.com",
 *   updates: [{ rowId, colId, value, baseRowVer }]
 * }
 */
app.http("auditorRequests_batch", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "auditorRequests/batch",
  extraOutputs: [signalROutput],
  handler: async (request, context) => {
    if (request.method === "OPTIONS") return noContent();

    const body = await readJson(request);
    if (!body) return badRequest("Invalid JSON body");

    const clientId = parseIntStrict(body.clientId);
    if (clientId == null) return badRequest("clientId is required and must be an integer");

    const byUser = str(body.byUser);
    const updates = Array.isArray(body.updates) ? body.updates : [];
    if (!updates.length) return ok({ results: [] });

    const normalized = [];
    for (const u of updates) {
      const rowId = str(u?.rowId);
      const colId = str(u?.colId);
      const value = (u?.value == null) ? "" : String(u.value);
      const baseRowVer = parseRowVerBase64(u?.baseRowVer);

      const sqlCol = COL_MAP[colId];
      if (!rowId || !colId || !sqlCol) {
        return badRequest("Invalid update; rowId/colId missing or colId not allowed", u);
      }
      if (!baseRowVer) {
        return badRequest("baseRowVer is required (base64 of 8 bytes rowversion)", u);
      }

      normalized.push({ rowId, colId, sqlCol, value, baseRowVer });
    }

    try {
      const pool = await getPool();
      const tx = new sql.Transaction(pool);
      await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);

      const results = [];
      const patchesToBroadcast = [];

      try {
        for (const u of normalized) {
          const holder = await checkLock({ clientId, rowId: u.rowId, colId: u.colId });
          if (holder && holder.userId && byUser && holder.userId !== byUser) {
            results.push({ rowId: u.rowId, colId: u.colId, status: "locked", holder });
            continue;
          }

          const req = new sql.Request(tx);
          req.input("ClientId", sql.Int, clientId);
          req.input("RowId", sql.UniqueIdentifier, u.rowId);
          req.input("ByUser", sql.NVarChar(200), byUser);
          req.input("NewVal", sql.NVarChar(sql.MAX), u.value);
          req.input("BaseRowVer", sql.Binary(8), u.baseRowVer);

          const cur = await req.query(`
            SELECT TOP 1 ${u.sqlCol} AS CurVal, RowVer, UpdatedAt, UpdatedBy
            FROM dbo.AuditorRequests
            WHERE ClientId=@ClientId AND RowId=@RowId;
          `);

          const curRow = cur.recordset?.[0];
          if (!curRow) {
            results.push({ rowId: u.rowId, colId: u.colId, status: "missing" });
            continue;
          }

          const oldValue = curRow.CurVal == null ? "" : String(curRow.CurVal);
          const curRowVerB64 = curRow.RowVer ? Buffer.from(curRow.RowVer).toString("base64") : null;
          const baseB64 = Buffer.from(u.baseRowVer).toString("base64");

          if (curRowVerB64 !== baseB64) {
            results.push({
              rowId: u.rowId,
              colId: u.colId,
              status: "conflict",
              current: {
                value: oldValue,
                rowVer: curRowVerB64,
                updatedAt: curRow.UpdatedAt ? new Date(curRow.UpdatedAt).toISOString() : null,
                updatedBy: curRow.UpdatedBy ?? null
              }
            });
            continue;
          }

          req.input("ColId", sql.NVarChar(128), u.colId);
          req.input("OldValue", sql.NVarChar(sql.MAX), oldValue);
          req.input("NewValue", sql.NVarChar(sql.MAX), u.value);

          const up = await req.query(`
            UPDATE dbo.AuditorRequests
            SET ${u.sqlCol} = @NewVal,
                UpdatedAt = sysutcdatetime(),
                UpdatedBy = @ByUser
            WHERE ClientId=@ClientId AND RowId=@RowId AND RowVer=@BaseRowVer;

            IF @@ROWCOUNT = 0
            BEGIN
              SELECT 0 AS Updated;
            END
            ELSE
            BEGIN
              INSERT INTO dbo.AuditorRequestEvents
                (ClientId, RowId, ColId, OldValue, NewValue, Action, ByUser)
              VALUES
                (@ClientId, @RowId, @ColId, @OldValue, @NewValue, 'cell_update', @ByUser);

              SELECT 1 AS Updated,
                     RowVer,
                     UpdatedAt,
                     UpdatedBy
              FROM dbo.AuditorRequests
              WHERE ClientId=@ClientId AND RowId=@RowId;
            END
          `);

          const updatedRow = up.recordset?.[0];
          if (!updatedRow || updatedRow.Updated !== 1) {
            results.push({ rowId: u.rowId, colId: u.colId, status: "conflict_race" });
            continue;
          }

          const newRowVerB64 = updatedRow.RowVer ? Buffer.from(updatedRow.RowVer).toString("base64") : null;
          const updatedAt = updatedRow.UpdatedAt ? new Date(updatedRow.UpdatedAt).toISOString() : null;
          const updatedBy = updatedRow.UpdatedBy ?? null;

          results.push({
            rowId: u.rowId,
            colId: u.colId,
            status: "updated",
            rowVer: newRowVerB64,
            updatedAt,
            updatedBy
          });

          patchesToBroadcast.push({
            kind: "cell",
            rowId: u.rowId,
            colId: u.colId,
            value: u.value,
            rowVer: newRowVerB64,
            updatedAt,
            updatedBy
          });
        }

        await tx.commit();

        if (patchesToBroadcast.length) {
          broadcast(context, clientId, "gridPatch", {
            clientId,
            byUser,
            atUtc: new Date().toISOString(),
            patches: patchesToBroadcast
          });
        }

        return ok({ results });
      } catch (inner) {
        await tx.rollback();
        throw inner;
      }
    } catch (e) {
      context.log("POST batch failed:", e);
      return serverError("Failed to save batch");
    }
  }
});

/**
 * GET /api/auditorRequests/events?clientId=123&afterEventId=0
 */
app.http("auditorRequests_events", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "auditorRequests/events",
  handler: async (request, context) => {
    if (request.method === "OPTIONS") return noContent();

    const url = new URL(request.url);
    const clientId = parseIntStrict(url.searchParams.get("clientId"));
    const afterEventId = Number(url.searchParams.get("afterEventId") || "0");

    if (clientId == null) return badRequest("clientId is required and must be an integer");

    try {
      const pool = await getPool();
      const rs = await pool.request()
        .input("clientId", sql.Int, clientId)
        .input("afterEventId", sql.BigInt, afterEventId)
        .query(`
          SELECT TOP 500
            EventId, ClientId, RowId, ColId, OldValue, NewValue, Action, ByUser, AtUtc
          FROM dbo.AuditorRequestEvents
          WHERE ClientId=@clientId AND EventId > @afterEventId
          ORDER BY EventId ASC;
        `);

      const events = (rs.recordset || []).map(e => ({
        eventId: Number(e.EventId),
        clientId: e.ClientId,
        rowId: e.RowId,
        colId: e.ColId ?? null,
        oldValue: e.OldValue ?? null,
        newValue: e.NewValue ?? null,
        action: e.Action,
        byUser: e.ByUser ?? null,
        atUtc: e.AtUtc ? new Date(e.AtUtc).toISOString() : null
      }));

      return ok({
        events,
        nextAfterEventId: events.length ? events[events.length - 1].eventId : afterEventId
      });
    } catch (e) {
      context.log("GET events failed:", e);
      return serverError("Failed to load events");
    }
  }
});
