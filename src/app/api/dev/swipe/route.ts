import { NextResponse } from "next/server";
import { z } from "zod";
import { nessieApi } from "@/lib/nessie/api";
import { NessieError } from "@/lib/nessie/client";
import { knownPersona, readSeedIds } from "@/lib/server/analysis";

const DEFAULT_SWIPE_CENTS = 80_000;
const MAX_SWIPE_CENTS = 500_000;

/**
 * Demo merchants by category. "gambling" is a blocked category in the guard (src/lib/engine/guard.ts);
 * Nessie's seed has none, so we create a real merchant on first use.
 */
const DEMO_MERCHANTS = {
  retail: { name: "Target", category: "retail" },
  gambling: { name: "Lucky Star Casino", category: "gambling" },
} as const;

const Body = z.object({
  persona: z.string().min(1).max(10),
  amountCents: z.number().int().positive().max(MAX_SWIPE_CENTS).default(DEFAULT_SWIPE_CENTS),
  merchantCategory: z.enum(["retail", "gambling"]).default("retail"),
});

/** Demo helper: post a real card purchase for the persona so the guard has something pending (~60s window). */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid body" }, { status: 400 });
  const { persona, amountCents, merchantCategory } = parsed.data;
  if (!knownPersona(persona)) return NextResponse.json({ error: "unknown persona" }, { status: 400 });
  const ids = readSeedIds()[persona];
  if (!ids?.cardId || !process.env.NESSIE_API_KEY) return NextResponse.json({ error: "persona not seeded or no key" }, { status: 503 });
  const api = nessieApi();
  try {
    const want = DEMO_MERCHANTS[merchantCategory];
    const existing = (await api.listMerchants()).find((m) => ((m as { category?: string }).category ?? "").toLowerCase() === want.category);
    const merchant = existing ?? await api.createMerchant({
      ...want,
      address: { street_number: "100", street_name: "Main St", city: "Dallas", state: "TX", zip: "75201" },
      geocode: { lat: 32.78, lng: -96.8 },
    });
    const name = (merchant as { name?: string }).name ?? want.name;
    const tx = await api.purchase(ids.cardId, { merchant_id: merchant.id, amount_cents: amountCents, description: `Card swipe (demo) at ${name}` });
    return NextResponse.json({ ok: true, txId: tx.id, status: tx.status, settle_at: tx.settle_at, merchant: name });
  } catch (e) {
    if (e instanceof NessieError) return NextResponse.json({ error: e.message }, { status: 503 });
    console.error("[swipe]", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
