import fs from "node:fs";
import path from "node:path";
import { NessieError } from "@/lib/nessie/client";
import { nessieApi } from "@/lib/nessie/api";
import type { Transaction } from "@/lib/nessie/types";
import { loadToyota } from "@/lib/toyota/load";
import { buildProfile } from "@/lib/engine/normalize";
import { analyze, type Analysis } from "@/lib/engine/analyze";
import type { NessieBundle, Profile } from "@/lib/engine/types";
import type { PersonaIds } from "@/lib/engine/execute";
import { planBank, syntheticBundle } from "@/lib/seed/plan";

const TXN_LIMIT = 200;

export function readSeedIds(): Record<string, Partial<PersonaIds>> {
  const p = path.join(process.cwd(), "data", "seed-ids.json");
  if (!fs.existsSync(p)) return {};
  return (JSON.parse(fs.readFileSync(p, "utf8")) as { personas?: Record<string, Partial<PersonaIds>> }).personas ?? {};
}

export function knownPersona(persona: string): boolean {
  return loadToyota().customers.some((c) => c.customer_id === persona);
}

export async function fetchBundle(ids: Partial<PersonaIds>): Promise<NessieBundle> {
  const api = nessieApi();
  if (!ids.customerId) throw new NessieError(404, "persona not seeded");
  const [customer, accounts] = await Promise.all([api.getCustomer(ids.customerId), api.getCustomerAccounts(ids.customerId)]);
  const txnEntries = await Promise.all(accounts.map(async (a) => [a.id, await api.listTransactions(a.id, TXN_LIMIT)] as [string, Transaction[]]));
  const [bills, loans] = await Promise.all([
    Promise.all(accounts.map((a) => api.getAccountBills(a.id))).then((r) => r.flat()),
    Promise.all(accounts.map((a) => api.getAccountLoans(a.id))).then((r) => r.flat()),
  ]);
  return { customer, accounts, transactionsByAccount: Object.fromEntries(txnEntries), bills, loans };
}

/** Synthetic bank for personas not yet in Nessie (ADR-009): same plan the seed script executes. */
export function syntheticProfile(persona: string): Profile {
  const t = loadToyota();
  const cust = t.customers.find((c) => c.customer_id === persona)!;
  const contract = t.accounts.find((a) => a.customer_id === persona)!;
  const vehicle = t.vehicles.find((v) => v.customer_id === persona)!;
  const bundle = syntheticBundle(planBank(cust, contract, vehicle, t.customers.indexOf(cust)), persona);
  return { ...buildProfile(bundle, t, persona), source: "snapshot" };
}

export interface Loaded { analysis: Analysis; live: boolean; ids?: PersonaIds }

/** Live Nessie when seeded + key present; otherwise synthetic. Throws NessieError on live failure. */
export async function getAnalysis(persona: string): Promise<Loaded> {
  const toyota = loadToyota();
  const ids = readSeedIds()[persona] as PersonaIds | undefined;
  if (!ids?.customerId || !process.env.NESSIE_API_KEY) return { analysis: analyze(syntheticProfile(persona), toyota), live: false };
  const bundle = await fetchBundle(ids);
  return { analysis: analyze(buildProfile(bundle, toyota, persona), toyota), live: true, ids };
}
