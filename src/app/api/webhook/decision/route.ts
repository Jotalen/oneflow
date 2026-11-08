import { NextResponse } from "next/server";
import { DedupeWindow, verifyNessieSignature } from "@/lib/nessie/webhook";
import { guardDecision } from "@/lib/engine/guard";
import { getAnalysis, readSeedIds } from "@/lib/server/analysis";

/**
 * Nessie decision-mode webhook (ADR-005, conditional on HTTPS deploy).
 * Verifies Nessie-Signature, de-dupes Nessie-Event-Id, maps the account to a persona, answers approve/decline.
 */
const dedupe = new DedupeWindow();
const decisions = new Map<string, { decision: string; reason: string; rule: string; at: number }>();

interface HookBody { id?: string; type?: string; account_id?: string; tx_id?: string; data?: Record<string, unknown>; transaction?: Record<string, unknown> }

function personaForAccount(accountId: string): string | null {
  for (const [pid, ids] of Object.entries(readSeedIds())) {
    if ([ids.checkingId, ids.savingsId, ids.cardId, ids.cdId].includes(accountId)) return pid;
  }
  return null;
}

export async function POST(req: Request) {
  const secret = process.env.NESSIE_WEBHOOK_SECRET ?? "";
  const raw = await req.text();
  const sig = req.headers.get("nessie-signature");
  const ts = req.headers.get("nessie-timestamp");
  if (secret && !verifyNessieSignature({ secret, timestamp: ts, body: raw, signature: sig })) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }
  const eventId = req.headers.get("nessie-event-id") ?? "";
  if (eventId && dedupe.seen(eventId)) {
    const prev = decisions.get(eventId);
    return NextResponse.json(prev ? { decision: prev.decision, reason: prev.reason } : { decision: "approve", reason: "duplicate delivery" });
  }
  let body: HookBody = {};
  try { body = JSON.parse(raw) as HookBody; } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const tx = (body.transaction ?? body.data ?? {}) as { id?: string; kind?: string; amount_cents?: number; description?: string; merchant_id?: string; payee_id?: string; payer_id?: string };
  const accountId = body.account_id ?? tx.payer_id ?? "";
  const persona = accountId ? personaForAccount(accountId) : null;
  if (!persona) return NextResponse.json({ decision: "approve", reason: "unknown account; fail open" });
  try {
    const { analysis } = await getAnalysis(persona);
    const g = guardDecision({ id: tx.id ?? body.tx_id ?? "", kind: tx.kind ?? "purchase", amountCents: Number(tx.amount_cents ?? 0), description: tx.description, payeeId: tx.payee_id }, analysis.profile, analysis.health);
    const decision = g.decision === "ask" ? "approve" : g.decision; // a hook must answer; "ask" falls open and is surfaced in the UI log
    if (eventId) decisions.set(eventId, { decision, reason: g.reason, rule: g.rule, at: Date.now() });
    return NextResponse.json({ decision, reason: g.reason.slice(0, 200), rule: g.rule, decision_source: "hook" });
  } catch (e) {
    console.error("[webhook]", e);
    return NextResponse.json({ decision: "approve", reason: "engine error; fail open" });
  }
}

export function GET() {
  return NextResponse.json({ ok: true, mode: "decision", kinds: ["purchase"], recent: [...decisions.entries()].slice(-10).map(([id, d]) => ({ id, ...d })) });
}
