/** Create the Tiger Data schema (hypertable + continuous aggregate + refresh policy). Idempotent. Usage: pnpm tiger:setup */
import { loadEnv } from "./_env";
import { SCHEMA_STATEMENTS } from "@/lib/tiger/schema";
import { tigerPool } from "@/lib/tiger/db";

async function main() {
  loadEnv();
  const pool = tigerPool();
  for (const sql of SCHEMA_STATEMENTS) {
    await pool.query(sql);
    console.log("ok:", sql.trim().split("\n")[0].slice(0, 80));
  }
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
