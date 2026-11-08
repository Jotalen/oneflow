/** Delete one persona's Nessie resources by stored ids (never DELETE /data). Usage: pnpm reset --persona C003 */
import { createNessieClient } from "@/lib/nessie/client";
import { makeApi, type NessieApi } from "@/lib/nessie/api";
import { arg, requireKey } from "./_env";
import { readSeedIds, writeSeedIds, type SeedIds } from "./_seed-ids";

const swallow404 = async (p: Promise<unknown>) => p.catch((e) => { if (e?.status !== 404) throw e; });

export async function resetPersona(api: NessieApi, ids: SeedIds, pid: string): Promise<void> {
  const p = ids.personas[pid];
  if (!p) { console.log(`${pid}: nothing to reset`); return; }
  for (const b of p.billIds ?? []) await swallow404(api.deleteBill(b));
  if (p.loanId) await swallow404(api.deleteLoan(p.loanId));
  for (const a of [p.cardId, p.cdId, p.savingsId, p.checkingId]) if (a) await swallow404(api.deleteAccount(a));
  if (p.customerId) await swallow404(api.deleteCustomer(p.customerId));
  delete ids.personas[pid];
  writeSeedIds(ids);
  console.log(`${pid}: reset`);
}

if (process.argv[1]?.endsWith("reset.ts")) {
  const pid = arg("persona");
  if (!pid) { console.error("usage: pnpm reset --persona C003"); process.exit(1); }
  requireKey();
  const api = makeApi(createNessieClient({ apiKey: process.env.NESSIE_API_KEY!, baseUrl: process.env.NESSIE_BASE_URL }));
  resetPersona(api, readSeedIds(), pid).catch((e) => { console.error(e); process.exit(1); });
}
