import { NextResponse } from "next/server";
import { NessieError } from "@/lib/nessie/client";
import { getAnalysis, knownPersona } from "@/lib/server/analysis";
import { getProvider } from "@/lib/llm";
import { coachAnalyze, runCoach } from "@/lib/llm/coach";
import type { Msg } from "@/lib/llm/provider";

const MAX_HISTORY = 8;
const MAX_MESSAGE_CHARS = 1_000;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { persona?: string; message?: string; mode?: "chat" | "analyze"; history?: Msg[] } | null;
  if (!body?.persona || !knownPersona(body.persona)) return NextResponse.json({ error: "valid persona required" }, { status: 400 });
  const mode = body.mode ?? "chat";
  const message = (body.message ?? "").slice(0, MAX_MESSAGE_CHARS);
  if (mode === "chat" && !message.trim()) return NextResponse.json({ error: "message required" }, { status: 400 });
  const history = (body.history ?? []).filter((m) => m.role === "user" || m.role === "assistant").slice(-MAX_HISTORY).map((m) => ({ role: m.role, content: String(m.content).slice(0, MAX_MESSAGE_CHARS) }));

  try {
    const { analysis } = await getAnalysis(body.persona);
    const provider = getProvider();
    const result = mode === "analyze" ? await coachAnalyze(analysis, provider) : await runCoach(analysis, message, provider, {}, history);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof NessieError) return NextResponse.json({ error: e.message }, { status: 503 });
    console.error("[coach]", e);
    const msg = e instanceof Error ? e.message : "coach failed";
    return NextResponse.json({ error: msg, hint: /429|quota|rate/i.test(msg) ? "LLM rate limited; set LLM_PROVIDER=stub for a deterministic narrator" : undefined }, { status: 502 });
  }
}
