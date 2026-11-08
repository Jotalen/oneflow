import { NextResponse } from "next/server";
import { NessieError } from "@/lib/nessie/client";
import { getAnalysis, knownPersona } from "@/lib/server/analysis";

export async function GET(req: Request, ctx: { params: Promise<{ persona: string }> }) {
  const { persona } = await ctx.params;
  // ?fresh=1: read Nessie now instead of this instance's 15s cache (used after money moves).
  const fresh = new URL(req.url).searchParams.get("fresh") === "1";
  if (!knownPersona(persona)) return NextResponse.json({ error: `unknown persona ${persona}` }, { status: 404 });
  try {
    const { analysis, live } = await getAnalysis(persona, { fresh });
    return NextResponse.json(analysis, { headers: { "x-nextmove-source": live ? "nessie" : "synthetic" } });
  } catch (e) {
    if (e instanceof NessieError) {
      console.error("[profile] Nessie error", e.status, e.message);
      return NextResponse.json({ error: e.message, retryAfter: e.retryAfter }, { status: 503 });
    }
    console.error("[profile] unexpected", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
