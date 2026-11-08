import { NextResponse } from "next/server";
import { nessieApi } from "@/lib/nessie/api";
import { NessieError } from "@/lib/nessie/client";
import type { Transaction } from "@/lib/nessie/types";
import { guardDecision } from "@/lib/engine/guard";
import { getAnalysis, invalidateAnalysis, knownPersona, readSeedIds } from "@/lib/server/analysis";
import { txBelongsTo } from "@/lib/engine/ownership";

type Api = ReturnType<typeof nessieApi>;
type Decision = "approve" | "decline";
interface Body { persona?: string; txId?: string; decision?: Decision; reason?: string }
interface Verdict { decision: Decision; reason: string; rule: string }
type GuardOutcome = Verdict | { ask: true; reason: string; rule: string };

/**
 * Nessie keeps a decided transaction pending until it is settled, so the hold stays on the card.
 * Settle right away: a decline then releases the hold and an approve completes. A 409 means it is
 * already final; read it back instead.
 */
async function settleNow(api: Api, txId: string): Promise<Transaction> {
  try {
    return await api.settle(txId);
  } catch (e) {
    if (e instanceof NessieError && e.status === 409) return api.getTransaction(txId);
    throw e;
  }
}

/** Guard rules (or the owner's explicit choice) for a pending transaction. */
async function verdictFor(api: Api, persona: string, tx: Transaction, body: Body): Promise<GuardOutcome> {
  if (body.decision) return { decision: body.decision, reason: body.reason ?? "", rule: "owner_override" };
  const { analysis } = await getAnalysis(persona);
  const merchant = tx.merchant_id ? await api.getMerchant(tx.merchant_id).catch(() => null) : null;
  const g = guardDecision({ id: tx.id, kind: tx.kind, amountCents: tx.amount_cents, description: tx.description, merchantCategory: (merchant as { category?: string } | null)?.category ?? null, payeeId: tx.payee_id }, analysis.profile, analysis.health);
  return g.decision === "ask" ? { ask: true, reason: g.reason, rule: g.rule } : { decision: g.decision, reason: g.reason, rule: g.rule };
}

/**
 * Record the decision, then settle. Every open screen runs the guard, so another screen may have
 * decided first: then settle and report that decision instead of failing.
 */
async function decideAndSettle(api: Api, txId: string, v: Verdict): Promise<{ tx: Transaction; alreadyDecided: boolean; decision: Decision }> {
  try {
    await api.decide(txId, { decision: v.decision, reason: v.reason.slice(0, 200) });
    return { tx: await settleNow(api, txId), alreadyDecided: false, decision: v.decision };
  } catch (e) {
    if (!(e instanceof NessieError) || e.status === 429) throw e;
    const now = await api.getTransaction(txId);
    if (!now.decision && now.status === "pending") throw e;
    const tx = now.status === "pending" ? await settleNow(api, txId) : now;
    return { tx, alreadyDecided: true, decision: (now.decision as Decision | null) ?? v.decision };
  }
}

/** POST { persona, txId, decision?: 'approve'|'decline', reason? } — omit decision to let the guard rules decide. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.persona || !body.txId || !knownPersona(body.persona)) return NextResponse.json({ error: "persona and txId required" }, { status: 400 });
  if (!process.env.NESSIE_API_KEY) return NextResponse.json({ error: "no Nessie key" }, { status: 503 });
  const api = nessieApi();
  try {
    const tx = await api.getTransaction(body.txId);
    if (!txBelongsTo(tx, readSeedIds()[body.persona] ?? {})) return NextResponse.json({ error: "transaction does not belong to this persona" }, { status: 403 });
    if (tx.status !== "pending") return NextResponse.json({ ok: true, alreadySettled: true, status: tx.status, decision: tx.decision, decision_source: tx.decision_source });
    const v = await verdictFor(api, body.persona, tx, body);
    if ("ask" in v) return NextResponse.json({ ok: true, ask: true, reason: v.reason, rule: v.rule });
    const done = await decideAndSettle(api, tx.id, v);
    invalidateAnalysis(body.persona);
    return NextResponse.json({ ok: true, decision: done.decision, reason: v.reason, rule: v.rule, status: done.tx.status, decision_source: done.tx.decision_source, alreadyDecided: done.alreadyDecided || undefined });
  } catch (e) {
    if (e instanceof NessieError) return NextResponse.json({ error: e.message, retryAfter: e.retryAfter }, { status: e.status === 429 ? 429 : 503 });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
