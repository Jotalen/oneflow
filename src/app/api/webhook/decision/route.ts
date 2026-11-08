import { NextResponse } from "next/server";
import { DedupeWindow, verifyNessieSignature } from "@/lib/nessie/webhook";
import { guardDecision } from "@/lib/engine/guard";
import { getAnalysis, readSeedIds } from "@/lib/server/analysis";
import { nessieApi } from "@/lib/nessie/api";

/**
 * Nessie decision-mode webhook (ADR-005, conditional on HTTPS deploy).
 * Verifies Nessie-Signature, de-dupes Nessie-Event-Id, maps the account to a persona, answers approve/decline.
 * Without NESSIE_WEBHOOK_SECRET it refuses to answer: decisions are never made on unsigned requests.
 */
const dedupe = new DedupeWindow();
const MAX_REMEMBERED_DECISIONS = 200;
const decisions = new Map<string, { decision: string; reason: string; rule: string; at: number }>();

function remember(eventId: string, d: { decision: string; reason: string; rule: string }) {
  decisions.set(eventId, { ...d, at: Date.now() });
  // Map keeps insertion order: drop the oldest beyond the cap.
  for (const k of decisions.keys()) { if (decisions.size <= MAX_REMEMBERED_DECISIONS) break; decisions.delete(k); }
}

async function merchantCategory(merchantId: string | undefined): Promise<string | null> {
  if (!merchantId) return null;
  const m = await nessieApi().getMerchant(merchantId).catch(() => null);
  return (m as { category?: string } | null)?.category ?? null;
}

interface HookBody { id?: string; type?: string; account_id?: string; tx_id?: string; data?: Record<string, unknown>; transaction?: Record<string, unknown> }

function personaForAccount(accountId: string): string | null {
  for (const [pid, ids] of Object.entries(readSeedIds())) {
    if ([ids.checkingId, ids.savingsId, ids.cardId, ids.cdId].includes(accountId)) return pid;
  }
  return null;
}

export async function POST(req: Request) {
  const secret = process.env.NESSIE_WEBHOOK_SECRET ?? "";
  if (!secret) return NextResponse.json({ error: "webhook not configured" }, { status: 503 });
  const raw = await req.text();
  const sig = req.headers.get("nessie-signature");
  const ts = req.headers.get("nessie-timestamp");
  if (!verifyNessieSignature({ secret, timestamp: ts, body: raw, signature: sig })) {
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
    const category = await merchantCategory(tx.merchant_id);
    const g = guardDecision({ id: tx.id ?? body.tx_id ?? "", kind: tx.kind ?? "purchase", amountCents: Number(tx.amount_cents ?? 0), description: tx.description, merchantCategory: category, payeeId: tx.payee_id }, analysis.profile, analysis.health);
    // A hook must answer now and cannot wait for the owner, so "ask" fails safe: decline, and say why.
    const decision = g.decision === "ask" ? "decline" : g.decision;
    const reason = g.decision === "ask" ? `${g.reason} Declined until you approve it in NovaBank.` : g.reason;
    if (eventId) remember(eventId, { decision, reason, rule: g.rule });
    return NextResponse.json({ decision, reason: reason.slice(0, 200), rule: g.rule, decision_source: "hook" });
  } catch (e) {
    console.error("[webhook]", e);
    return NextResponse.json({ decision: "approve", reason: "engine error; fail open" });
  }
}

export function GET() {
  // Public health check: reasons quote customer balances, so only expose rule names and timestamps.
  return NextResponse.json({ ok: true, mode: "decision", kinds: ["purchase"], recent: [...decisions.entries()].slice(-10).map(([id, d]) => ({ id, decision: d.decision, rule: d.rule, at: d.at })) });
}
