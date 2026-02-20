const sql = require("mssql");

let poolPromise = null;

/**
 * Uses connection string in env var: SqlConnectionString
 * Example:
 * Server=tcp:<server>.database.windows.net,1433;Database=<db>;
 * User ID=<user>;Password=<pwd>;
 * Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;
 */
function getPool() {
  if (!poolPromise) {
    const cs = process.env.SqlConnectionString || process.env.SQL_CONNECTION_STRING;
    if (!cs) throw new Error("Missing app setting: SqlConnectionString (or SQL_CONNECTION_STRING)");
    poolPromise = sql.connect(cs);
  }
  return poolPromise;
}

module.exports = { sql, getPool };
