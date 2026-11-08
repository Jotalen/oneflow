import { NextResponse } from "next/server";
import { nessieApi } from "@/lib/nessie/api";
import { NessieError } from "@/lib/nessie/client";
import { guardDecision } from "@/lib/engine/guard";
import { getAnalysis, invalidateAnalysis, knownPersona, readSeedIds } from "@/lib/server/analysis";
import { txBelongsTo } from "@/lib/engine/ownership";

/** POST { persona, txId, decision?: 'approve'|'decline', reason? } — omit decision to let the guard rules decide. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { persona?: string; txId?: string; decision?: "approve" | "decline"; reason?: string } | null;
  if (!body?.persona || !body.txId || !knownPersona(body.persona)) return NextResponse.json({ error: "persona and txId required" }, { status: 400 });
  if (!process.env.NESSIE_API_KEY) return NextResponse.json({ error: "no Nessie key" }, { status: 503 });
  const api = nessieApi();
  try {
    const tx = await api.getTransaction(body.txId);
    const ids = readSeedIds()[body.persona] ?? {};
    if (!txBelongsTo(tx, ids)) return NextResponse.json({ error: "transaction does not belong to this persona" }, { status: 403 });
    if (tx.status !== "pending") return NextResponse.json({ ok: true, alreadySettled: true, status: tx.status, decision: tx.decision, decision_source: tx.decision_source });
    let decision = body.decision;
    let reason = body.reason ?? "";
    let rule = "owner_override";
    if (!decision) {
      const { analysis } = await getAnalysis(body.persona);
      const merchant = tx.merchant_id ? await api.getMerchant(tx.merchant_id).catch(() => null) : null;
      const g = guardDecision({ id: tx.id, kind: tx.kind, amountCents: tx.amount_cents, description: tx.description, merchantCategory: (merchant as { category?: string } | null)?.category ?? null, payeeId: tx.payee_id }, analysis.profile, analysis.health);
      if (g.decision === "ask") return NextResponse.json({ ok: true, ask: true, reason: g.reason, rule: g.rule });
      decision = g.decision;
      reason = g.reason;
      rule = g.rule;
    }
    const updated = await api.decide(tx.id, { decision, reason: reason.slice(0, 200) });
    invalidateAnalysis(body.persona);
    return NextResponse.json({ ok: true, decision, reason, rule, status: updated.status, decision_source: updated.decision_source });
  } catch (e) {
    if (e instanceof NessieError) return NextResponse.json({ error: e.message, retryAfter: e.retryAfter }, { status: e.status === 429 ? 429 : 503 });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
