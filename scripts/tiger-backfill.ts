/**
 * Copy Nessie's event history into Tiger Data, resuming from the highest stored seq, then refresh
 * the balance aggregate. The app keeps it current afterwards (/api/events writes each page it reads).
 * Usage: pnpm tiger:backfill
 */
import { requireKey } from "./_env";
import { createNessieClient } from "@/lib/nessie/client";
import { makeApi } from "@/lib/nessie/api";
import { readSeedIds } from "@/lib/server/analysis";
import { personaIndex, toEventRow } from "@/lib/tiger/events";
import { insertEvents, maxStoredSeq } from "@/lib/tiger/store";
import { tigerPool } from "@/lib/tiger/db";

const PAGE = 500;
const MAX_PAGES = 200;

async function main() {
  requireKey();
  const api = makeApi(createNessieClient({ apiKey: process.env.NESSIE_API_KEY!, baseUrl: process.env.NESSIE_BASE_URL }));
  const personas = personaIndex(readSeedIds());
  let after = await maxStoredSeq();
  let total = 0;
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await api.listEvents({ after, limit: PAGE });
    total += await insertEvents(page.items.map((e) => toEventRow(e, personas)));
    after = Math.max(after, page.next_cursor);
    if (page.items.length < PAGE) break;
  }
  await tigerPool().query("CALL refresh_continuous_aggregate('account_balance_15m', NULL, NULL)");
  console.log(`inserted ${total} events; cursor now ${after}`);
  await tigerPool().end();
}

main().catch((e) => { console.error(e); process.exit(1); });
