/** Delete one persona's Nessie resources by stored ids (never DELETE /data). Usage: pnpm reset --persona C003 */
import { createNessieClient } from "@/lib/nessie/client";
import { makeApi, type NessieApi } from "@/lib/nessie/api";
import { arg, requireKey } from "./_env";
import { readSeedIds, writeSeedIds, type SeedIds } from "./_seed-ids";

const swallow404 = async (p: Promise<unknown>) => p.catch((e) => { if (e?.status !== 404) throw e; });

/** Seeded ids plus whatever the app created at runtime (CDs from openCd, autopay bills), read live from Nessie. */
async function liveResources(api: NessieApi, p: SeedIds["personas"][string]) {
  const seededAccounts = [p.cardId, p.cdId, p.savingsId, p.checkingId].filter((a): a is string => !!a);
  const live = p.customerId ? await api.getCustomerAccounts(p.customerId).catch(() => []) : [];
  const accounts = [...new Set([...live.map((a) => a.id), ...seededAccounts])];
  const bills = new Set(p.billIds ?? []);
  const loans = new Set(p.loanId ? [p.loanId] : []);
  for (const a of accounts) {
    for (const b of await api.getAccountBills(a).catch(() => [])) bills.add(b.id);
    for (const l of await api.getAccountLoans(a).catch(() => [])) loans.add(l.id);
  }
  return { accounts, bills: [...bills], loans: [...loans] };
}

export async function resetPersona(api: NessieApi, ids: SeedIds, pid: string): Promise<void> {
  const p = ids.personas[pid];
  if (!p) { console.log(`${pid}: nothing to reset`); return; }
  const r = await liveResources(api, p);
  for (const b of r.bills) await swallow404(api.deleteBill(b));
  for (const l of r.loans) await swallow404(api.deleteLoan(l));
  for (const a of r.accounts) await swallow404(api.deleteAccount(a));
  if (p.customerId) await swallow404(api.deleteCustomer(p.customerId));
  delete ids.personas[pid];
  writeSeedIds(ids);
  console.log(`${pid}: reset (${r.accounts.length} accounts, ${r.bills.length} bills, ${r.loans.length} loans)`);
}

if (process.argv[1]?.endsWith("reset.ts")) {
  const pid = arg("persona");
  if (!pid) { console.error("usage: pnpm reset --persona C003"); process.exit(1); }
  requireKey();
  const api = makeApi(createNessieClient({ apiKey: process.env.NESSIE_API_KEY!, baseUrl: process.env.NESSIE_BASE_URL }));
  resetPersona(api, readSeedIds(), pid).catch((e) => { console.error(e); process.exit(1); });
}
