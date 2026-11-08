import { NextResponse } from "next/server";
import { nessieApi } from "@/lib/nessie/api";
import { NessieError } from "@/lib/nessie/client";
import { describeOps, executeMove, type PersonaIds } from "@/lib/engine/execute";
import { getAnalysis, knownPersona } from "@/lib/server/analysis";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { persona?: string; moveId?: string } | null;
  if (!body?.persona || !body.moveId) return NextResponse.json({ error: "persona and moveId required" }, { status: 400 });
  if (!knownPersona(body.persona)) return NextResponse.json({ error: `unknown persona ${body.persona}` }, { status: 404 });
  try {
  const { analysis, live, ids } = await getAnalysis(body.persona);
  const move = analysis.ranked.find((m) => m.id === body.moveId);
  if (!move) return NextResponse.json({ error: `unknown move ${body.moveId}` }, { status: 404 });
  if (!move.execution?.length) return NextResponse.json({ error: "this move has no bank-side execution" }, { status: 422 });

  if (!live || !ids) {
    const fakeIds: PersonaIds = { customerId: "demo", checkingId: `${body.persona}-checking`, savingsId: `${body.persona}-savings`, cardId: `${body.persona}-card`, billIds: [] };
    return NextResponse.json({ ok: true, simulated: true, txIds: [], billIds: [], accountIds: [], receipt: describeOps(move, fakeIds) });
  }
  const api = nessieApi();
  const result = await executeMove(api, move, ids);
  if (result.ok) {
    // Nessie v2 lets the account owner settle early; do it so the feed shows pending → completed at demo speed.
    await Promise.all(result.txIds.map((id) => api.settle(id).catch((e) => { if (!(e instanceof NessieError) || e.status !== 409) console.warn("[execute] settle", id, e?.status); })));
  }
  return NextResponse.json({ ...result, simulated: false, receipt: describeOps(move, ids) }, { status: result.ok ? 200 : result.status === 429 ? 429 : 502 });
  } catch (e) {
    if (e instanceof NessieError) return NextResponse.json({ ok: false, error: e.message, status: e.status, retryAfter: e.retryAfter }, { status: e.status === 429 ? 429 : 503 });
    console.error("[execute]", e);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
}
