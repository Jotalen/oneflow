import { NextResponse } from "next/server";
import { nessieApi } from "@/lib/nessie/api";
import { NessieError } from "@/lib/nessie/client";
import { getAnalysis, knownPersona, readSeedIds } from "@/lib/server/analysis";

/** Demo helper: post a card purchase for the persona so the guard has something pending (~60s window). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { persona?: string; amountCents?: number; merchantCategory?: string } | null;
  if (!body?.persona || !knownPersona(body.persona)) return NextResponse.json({ error: "persona required" }, { status: 400 });
  const ids = readSeedIds()[body.persona];
  if (!ids?.cardId || !process.env.NESSIE_API_KEY) return NextResponse.json({ error: "persona not seeded or no key" }, { status: 503 });
  const api = nessieApi();
  try {
    const merchants = await api.listMerchants();
    const want = (body.merchantCategory ?? "retail").toLowerCase();
    const merchant = merchants.find((m) => ((m as { category?: string }).category ?? "").toLowerCase() === want) ?? merchants[0];
    if (!merchant) return NextResponse.json({ error: "no merchants" }, { status: 503 });
    const { analysis } = await getAnalysis(body.persona);
    void analysis;
    const tx = await api.purchase(ids.cardId, { merchant_id: merchant.id, amount_cents: body.amountCents ?? 80_000, description: `Card swipe (demo) at ${(merchant as { name?: string }).name ?? "merchant"}` });
    return NextResponse.json({ ok: true, txId: tx.id, status: tx.status, settle_at: tx.settle_at });
  } catch (e) {
    if (e instanceof NessieError) return NextResponse.json({ error: e.message }, { status: 503 });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
