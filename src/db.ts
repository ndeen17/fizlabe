import { Pool, PoolConfig } from 'pg';
import fs from 'node:fs';
import path from 'node:path';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  const config: PoolConfig = { connectionString };
  // Neon and most hosted Postgres require SSL. Local Docker does not.
  if (/sslmode=require/.test(connectionString) || /neon\.tech|render\.com|supabase\.co/.test(connectionString)) {
    config.ssl = { rejectUnauthorized: false };
  }
  pool = new Pool(config);
  return pool;
}

/** Allow tests to inject a pg-mem backed pool. */
export function setPool(p: Pool): void {
  pool = p;
}

export async function initSchema(): Promise<void> {
  const sqlPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await getPool().query(sql);
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
