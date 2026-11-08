import { NextResponse } from "next/server";
import { knownPersona, readSeedIds } from "@/lib/server/analysis";
import { tigerConfigured } from "@/lib/tiger/db";
import { buildBalanceSeries } from "@/lib/tiger/history";
import { readActivity, readBalanceBuckets } from "@/lib/tiger/store";

/** Balance history + bank activity for one persona, from Tiger Data (TimescaleDB continuous aggregate). */
export async function GET(_req: Request, ctx: { params: Promise<{ persona: string }> }) {
  const { persona } = await ctx.params;
  if (!knownPersona(persona)) return NextResponse.json({ error: `unknown persona ${persona}` }, { status: 404 });
  if (!tigerConfigured()) return NextResponse.json({ ok: false, configured: false });
  const ids = readSeedIds()[persona] ?? {};
  const accounts = [
    { id: ids.checkingId, kind: "checking" },
    { id: ids.savingsId, kind: "savings" },
    { id: ids.cdId, kind: "cd" },
    { id: ids.cardId, kind: "card" },
  ].filter((a): a is { id: string; kind: string } => !!a.id);
  try {
    const [buckets, activity] = await Promise.all([readBalanceBuckets(persona), readActivity(persona)]);
    return NextResponse.json({ ok: true, source: "tiger", points: buildBalanceSeries(buckets, accounts), activity });
  } catch (e) {
    console.error("[history] Tiger query failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, configured: true, error: "Balance history is unavailable right now." }, { status: 503 });
  }
}
