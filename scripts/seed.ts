/**
 * Seed the 20 Toyota personas into Nessie v2 (ADR-007). Resumable: writes data/seed-ids.json
 * after every resource. Usage: pnpm seed [--persona C003] [--force]
 */
import { createNessieClient, NessieError } from "@/lib/nessie/client";
import { makeApi, type NessieApi } from "@/lib/nessie/api";
import { loadToyota } from "@/lib/toyota/load";
import { MERCHANTS, planBank, type BankPlan } from "@/lib/seed/plan";
import { flag, requireKey } from "./_env";
import { readSeedIds, writeSeedIds, type PersonaIds, type SeedIds } from "./_seed-ids";
import { resetPersona } from "./reset";

const PRIORITY = ["C003", "C014", "C001"];
const SEED_RATE_PER_MINUTE = 100; // headroom under the 120/min cap
const MAX_ATTEMPTS = 4;
const RETRY_DELAY_MS = 3_000;

async function ensureMerchants(api: NessieApi, ids: SeedIds): Promise<Record<string, string>> {
  ids._merchants ??= {};
  for (const m of MERCHANTS) {
    if (ids._merchants[m.cat]) continue;
    const created = await api.createMerchant({
      name: m.name,
      category: m.cat,
      address: { street_number: "100", street_name: "Main St", city: "Dallas", state: "TX", zip: "75201" },
      geocode: { lat: 32.78, lng: -96.8 },
    });
    ids._merchants[m.cat] = created.id;
    writeSeedIds(ids);
    console.log(`  merchant ${m.cat} -> ${created.id}`);
  }
  return ids._merchants;
}

async function settleQuietly(api: NessieApi, txId: string): Promise<void> {
  try { await api.settle(txId); } catch (e) { if (!(e instanceof NessieError) || ![404, 409, 422].includes(e.status)) throw e; }
}

async function seedPersona(api: NessieApi, ids: SeedIds, plan: BankPlan) {
  const pid = plan.personaId;
  const p: Partial<PersonaIds> = (ids.personas[pid] ??= { billIds: [], purchaseCount: 0, depositCount: 0 });
  const save = () => writeSeedIds(ids);
  const merchants = ids._merchants!;

  if (!p.customerId) {
    p.customerId = (await api.createCustomer({ first_name: plan.customer.firstName, last_name: plan.customer.lastName, address: plan.customer.address })).id;
    save();
  }
  const cid = p.customerId;
  const slot = { checking: "checkingId", savings: "savingsId", cd: "cdId", card: "cardId" } as const;
  for (const a of plan.accounts) {
    const key = slot[a.kind];
    if (p[key]) continue;
    const type = a.kind === "card" ? "Credit Card" : a.kind === "checking" ? "Checking" : "Savings";
    p[key] = (await api.createAccount(cid, { type, nickname: a.nickname, balance_cents: a.balance, credit_limit_cents: a.creditLimit })).id;
    save();
  }
  for (let i = p.depositCount ?? 0; i < plan.deposits.count; i++) {
    const dep = await api.deposit(p.checkingId!, { amount_cents: plan.deposits.amount, description: plan.deposits.description });
    await settleQuietly(api, dep.id); // deposits hold ~10s; settle so purchases can spend them
    p.depositCount = i + 1; save();
  }
  for (let i = p.purchaseCount ?? 0; i < plan.purchases.length; i++) {
    const x = plan.purchases[i];
    const body = { merchant_id: merchants[x.category], amount_cents: x.amount, description: x.merchantName };
    try {
      const tx = await api.purchase(x.onCard ? p.cardId! : p.checkingId!, body);
      await settleQuietly(api, tx.id);
    } catch (e) {
      if (!(e instanceof NessieError && e.status === 422)) throw e;
      // Insufficient funds on checking → card; card full → skip this one (logged).
      const alt = x.onCard ? p.checkingId! : p.cardId!;
      try { const tx = await api.purchase(alt, body); await settleQuietly(api, tx.id); }
      catch (e2) { if (!(e2 instanceof NessieError && e2.status === 422)) throw e2; console.warn(`  ${pid}: skipped purchase ${i} (${x.amount}c), no funds`); }
    }
    p.purchaseCount = i + 1; save();
  }
  p.billIds ??= [];
  for (let i = p.billIds.length; i < plan.bills.length; i++) {
    const b = plan.bills[i];
    p.billIds.push((await api.createBill(p.checkingId!, { status: "recurring", payee: b.payee, amountCents: b.amount, recurring_date: b.day, nickname: b.nickname })).id);
    save();
  }
  if (!p.loanId) {
    const l = plan.loan;
    p.loanId = (await api.createLoan(p.checkingId!, { type: l.type, status: l.status, credit_score: l.creditScore, monthly_payment_cents: l.monthlyPayment, amount_cents: l.amount, description: l.description })).id;
    save();
  }
  console.log(`  ${pid} ${plan.customer.firstName}: customer ${cid}, ${p.depositCount} deposits, ${p.purchaseCount} purchases, ${p.billIds.length} bills, loan ${p.loanId}`);
}

async function main() {
  requireKey();
  const api = makeApi(createNessieClient({ apiKey: process.env.NESSIE_API_KEY!, baseUrl: process.env.NESSIE_BASE_URL, ratePerMinute: SEED_RATE_PER_MINUTE }));
  const t = loadToyota();
  const ids = readSeedIds();
  const only = process.argv.filter((_, i) => process.argv[i - 1] === "--persona");
  const force = flag("force");
  const order = [...PRIORITY, ...t.customers.map((c) => c.customer_id).filter((id) => !PRIORITY.includes(id))];
  const targets = only.length ? only : order;

  console.log("merchants…");
  await ensureMerchants(api, ids);
  for (const pid of targets) {
    const cust = t.customers.find((c) => c.customer_id === pid);
    const contract = t.accounts.find((a) => a.customer_id === pid);
    const vehicle = t.vehicles.find((v) => v.customer_id === pid);
    if (!cust || !contract || !vehicle) { console.warn(`skip ${pid}: missing rows`); continue; }
    const existing = ids.personas[pid];
    if (existing?.loanId && !force) { console.log(`  ${pid} already seeded`); continue; }
    if (existing?.customerId && force) await resetPersona(api, ids, pid);
    console.log(`seeding ${pid}…`);
    const plan = planBank(cust, contract, vehicle, t.customers.indexOf(cust));
    for (let attempt = 1; ; attempt++) {
      try { await seedPersona(api, ids, plan); break; }
      catch (e) {
        // Nessie occasionally returns 5xx; seeding is resumable, so wait and continue from saved progress.
        if (!(e instanceof NessieError) || e.status < 500 || attempt >= MAX_ATTEMPTS) throw e;
        console.warn(`  ${pid}: Nessie ${e.status}, retry ${attempt}/${MAX_ATTEMPTS - 1} in ${RETRY_DELAY_MS / 1000}s`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }
  console.log(`done → ${targets.length} persona(s)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
