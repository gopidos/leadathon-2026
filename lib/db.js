// Minimal MySQL helper (mysql2/promise pool), server-side only.
const mysql = require('mysql2/promise');

let pool = null;
function getPool() {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  const opts = url || {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };
  pool = mysql.createPool(Object.assign(
    typeof opts === 'string' ? { uri: opts } : opts,
    { waitForConnections: true, connectionLimit: 10, timezone: 'Z' }
  ));
  return pool;
}

const configured = () => !!(process.env.DATABASE_URL || (process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME));

async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

// Runs fn(conn) inside a transaction; conn.execute(sql, params) is used by fn.
async function withTransaction(fn) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { query, withTransaction, configured };
