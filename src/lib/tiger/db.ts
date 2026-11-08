import { Pool } from "pg";
import { TIMESCALE_CA } from "./ca";

const POOL_MAX = 3;
const CONNECT_TIMEOUT_MS = 5_000;
const STATEMENT_TIMEOUT_MS = 8_000;

let pool: Pool | null = null;

/** True when a Tiger Data (TimescaleDB) connection string is configured. */
export const tigerConfigured = (): boolean => !!process.env.DATABASE_URL;

/** Shared pool. TLS is verified against the pinned Timescale CA; the URL's sslmode is ignored. */
export function tigerPool(): Pool {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const u = new URL(url);
  u.searchParams.delete("sslmode");
  pool = new Pool({
    connectionString: u.toString(),
    ssl: { ca: TIMESCALE_CA },
    max: POOL_MAX,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    statement_timeout: STATEMENT_TIMEOUT_MS,
  });
  pool.on("error", (e) => console.warn("[tiger] idle client error", e.message));
  return pool;
}
