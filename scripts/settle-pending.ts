/** Settle any seeded-account transactions still pending (seed hygiene). Usage: pnpm tsx scripts/settle-pending.ts */
import { createNessieClient, NessieError } from "@/lib/nessie/client";
import { makeApi } from "@/lib/nessie/api";
import { requireKey } from "./_env";
import { readSeedIds } from "./_seed-ids";

async function main() {
  requireKey();
  const api = makeApi(createNessieClient({ apiKey: process.env.NESSIE_API_KEY!, baseUrl: process.env.NESSIE_BASE_URL, ratePerMinute: 100 }));
  const ids = readSeedIds();
  let settled = 0, failed = 0;
  for (const [pid, p] of Object.entries(ids.personas)) {
    for (const acct of [p.checkingId, p.savingsId, p.cardId, p.cdId].filter(Boolean) as string[]) {
      const txns = await api.listTransactions(acct, 500);
      for (const t of txns.filter((x) => x.status === "pending")) {
        try { await api.settle(t.id); settled++; }
        catch (e) { failed++; if (e instanceof NessieError) console.warn(`  ${pid} ${t.id}: ${e.status} ${JSON.stringify(e.body).slice(0, 160)}`); else throw e; }
      }
    }
  }
  console.log(`settled ${settled}, failed ${failed}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
