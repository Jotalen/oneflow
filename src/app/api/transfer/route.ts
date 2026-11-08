import { NextResponse } from "next/server";
import { z } from "zod";
import { nessieApi } from "@/lib/nessie/api";
import { NessieError } from "@/lib/nessie/client";
import { getAnalysis, invalidateAnalysis, knownPersona } from "@/lib/server/analysis";

/** User-initiated money movement (Add money to a goal, Pay card, extra payment). Executes in Nessie. */
const MAX_TRANSFER_CENTS = 5_000_000;
const Body = z
  .object({
    persona: z.string().min(1).max(10),
    from: z.enum(["checking", "savings"]),
    to: z.enum(["checking", "savings", "card"]),
    amountCents: z.number().int().positive().max(MAX_TRANSFER_CENTS),
    purpose: z.string().trim().min(1).max(80).optional(),
  })
  .refine((b) => b.from !== b.to, { message: "from and to must differ" });

const DEFAULT_PURPOSE: Record<string, string> = { savings: "Move to savings", card: "Card payment", checking: "Move to checking" };

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "invalid body" }, { status: 400 });
  const b = parsed.data;
  if (!knownPersona(b.persona)) return NextResponse.json({ ok: false, error: `unknown persona ${b.persona}` }, { status: 404 });
  try {
    const { analysis, live, ids } = await getAnalysis(b.persona);
    const kindOf = (k: "checking" | "savings" | "card") => analysis.profile.accounts.find((a) => a.kind === k);
    const src = kindOf(b.from);
    const dst = kindOf(b.to);
    if (!src || !dst) return NextResponse.json({ ok: false, error: "account not found" }, { status: 404 });
    if (b.amountCents > src.available) return NextResponse.json({ ok: false, error: `Only ${(src.available / 100).toFixed(2)} available in ${b.from}` }, { status: 422 });
    if (b.to === "card" && b.amountCents > dst.balance) return NextResponse.json({ ok: false, error: "Payment is more than the card balance" }, { status: 422 });
    const description = b.purpose ?? DEFAULT_PURPOSE[b.to];
    if (!live || !ids) return NextResponse.json({ ok: true, simulated: true, txIds: [], description });

    const idOf = { checking: ids.checkingId, savings: ids.savingsId, card: ids.cardId };
    const api = nessieApi();
    const tx = await api.transfer(idOf[b.from], { payee_id: idOf[b.to], amount_cents: b.amountCents, description });
    await api.settle(tx.id).catch((e) => { if (!(e instanceof NessieError) || e.status !== 409) console.warn("[transfer] settle", tx.id, e?.status); });
    invalidateAnalysis(b.persona);
    return NextResponse.json({ ok: true, simulated: false, txIds: [tx.id], description });
  } catch (e) {
    if (e instanceof NessieError) return NextResponse.json({ ok: false, error: e.message, retryAfter: e.retryAfter }, { status: e.status === 429 ? 429 : 502 });
    console.error("[transfer]", e);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
}
