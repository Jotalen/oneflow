import { NextResponse } from "next/server";
import { z } from "zod";
import { NessieError } from "@/lib/nessie/client";
import { getAnalysis, knownPersona } from "@/lib/server/analysis";
import { providerChain } from "@/lib/llm";
import { answerAssist } from "@/lib/llm/assist";
import { MAX_ESSENTIAL } from "@/lib/bank/wealth";

/**
 * "Ask AI" for one topic. Code computes every fact; the model (Gemini → OpenRouter) only phrases them,
 * and the offline answer from the same facts is used when no model is available or a model strays.
 */
const MAX_QUESTION_CHARS = 300;
const MAX_OVERRIDES = 20;

const Body = z
  .object({
    persona: z.string().min(1).max(10),
    topic: z.enum(["safety_net", "which_card"]),
    question: z.string().trim().min(1).max(MAX_QUESTION_CHARS).optional(),
    /** The customer's own monthly essentials (cents by essential key), as set on the safety net page. */
    essentialsOverrides: z
      .record(z.string().max(40), z.number().int().min(0).max(MAX_ESSENTIAL))
      .refine((o) => Object.keys(o).length <= MAX_OVERRIDES, { message: "too many essentials" })
      .optional(),
  })
  .refine((b) => b.topic !== "which_card" || !!b.question, { message: "question required for which_card" });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "invalid body" }, { status: 400 });
  const b = parsed.data;
  if (!knownPersona(b.persona)) return NextResponse.json({ ok: false, error: "valid persona required" }, { status: 400 });
  try {
    const { analysis } = await getAnalysis(b.persona);
    const answer = await answerAssist({ analysis, topic: b.topic, question: b.question, overrides: b.essentialsOverrides }, providerChain());
    return NextResponse.json({ ok: true, ...answer });
  } catch (e) {
    if (e instanceof NessieError) return NextResponse.json({ ok: false, error: "The bank is busy right now. Try again in a minute." }, { status: 503 });
    console.error("[assist]", e);
    return NextResponse.json({ ok: false, error: "Couldn't build an answer right now." }, { status: 500 });
  }
}
