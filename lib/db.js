import "server-only";
import { Pool } from "pg";

let pool = null;
let schemaPromise = null;

function getPoolConfig() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return null;
  }

  const sslEnabled =
    process.env.DATABASE_SSL === "true" || process.env.PGSSL === "true";

  return {
    connectionString,
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined
  };
}

export function getPool() {
  if (pool) {
    return pool;
  }

  const config = getPoolConfig();
  if (!config) {
    return null;
  }

  pool = new Pool(config);
  return pool;
}

export async function ensureSchema() {
  const currentPool = getPool();
  if (!currentPool) {
    return;
  }

  if (!schemaPromise) {
    schemaPromise = (async () => {
      await currentPool.query(`
        CREATE TABLE IF NOT EXISTS company_results (
          id UUID PRIMARY KEY,
          url TEXT NOT NULL,
          url_key TEXT NOT NULL UNIQUE,
          analysis JSONB NOT NULL,
          context TEXT,
          sources JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await currentPool.query(`
        CREATE INDEX IF NOT EXISTS company_results_created_at_idx
        ON company_results (created_at);
      `);
    })();
  }

  await schemaPromise;
}
