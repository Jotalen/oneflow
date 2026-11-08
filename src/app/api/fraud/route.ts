import { connection, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { nessieApi } from "@/lib/nessie/api";
import { NessieError } from "@/lib/nessie/client";
import { detectAnomalies, type AnomalyTxn } from "@/lib/engine/anomaly";

const TXN_LIMIT = 500;
const CACHE_MS = 60_000;
interface SimIds { simulationId: string; customerIds: string[]; accountIds: string[]; merchantIds: string[]; generated?: number; anomalies?: number }
let cache: { at: number; body: unknown } | null = null;

export async function GET() {
  await connection();
  const p = path.join(process.cwd(), "data", "sim-ids.json");
  if (!fs.existsSync(p)) return NextResponse.json({ available: false, reason: "no simulation yet (run `pnpm simulate`)" });
  if (!process.env.NESSIE_API_KEY) return NextResponse.json({ available: false, reason: "NESSIE_API_KEY not set" });
  if (cache && Date.now() - cache.at < CACHE_MS) return NextResponse.json(cache.body);
  const sim = JSON.parse(fs.readFileSync(p, "utf8")) as SimIds;
  const api = nessieApi();
  try {
    const [txnLists, merchants] = await Promise.all([
      Promise.all(sim.accountIds.map((id) => api.listTransactions(id, TXN_LIMIT).then((l) => l.map((t) => ({ ...t, accountId: id }))))),
      api.listMerchants().catch(() => []),
    ]);
    const merchantState = Object.fromEntries(merchants.map((m) => [m.id, ((m as { address?: { state?: string } }).address?.state ?? "").toUpperCase()]).filter(([, s]) => s));
    const txns: AnomalyTxn[] = txnLists.flat().map((t) => ({ id: t.id, accountId: t.accountId, kind: t.kind, status: t.status, amountCents: t.amount_cents, merchantId: t.merchant_id, payeeId: t.payee_id, createdAt: t.created_at }));
    const anomalies = detectAnomalies(txns, merchantState);
    const body = { available: true, simulationId: sim.simulationId, customers: sim.customerIds.length, accounts: sim.accountIds.length, transactions: txns.length, generatedAnomalies: sim.anomalies ?? null, anomalies, counts: anomalies.reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.rule]: (acc[a.rule] ?? 0) + 1 }), {}) };
    cache = { at: Date.now(), body };
    return NextResponse.json(body);
  } catch (e) {
    if (e instanceof NessieError) return NextResponse.json({ available: false, reason: e.message }, { status: 503 });
    return NextResponse.json({ available: false, reason: "internal" }, { status: 500 });
  }
}
