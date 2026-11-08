import { NextResponse } from "next/server";
import { NessieError } from "@/lib/nessie/client";
import { getAnalysis, knownPersona } from "@/lib/server/analysis";
import { providerChain } from "@/lib/llm";
import type { LlmProvider } from "@/lib/llm/provider";
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
    const run = (provider: LlmProvider) => (mode === "analyze" ? coachAnalyze(analysis, provider) : runCoach(analysis, message, provider, {}, history));
    const chain = providerChain();
    const failed: string[] = [];
    for (const provider of chain) {
      try {
        const result = await run(provider);
        const notice = failed.length ? `${failed.join(" and ")} ${failed.length > 1 ? "were" : "was"} busy, so ${provider.name === "stub" ? "OneFlow's built-in narrator" : provider.name} answered. Same numbers, same rules.` : undefined;
        return NextResponse.json({ ...result, provider: provider.name, ...(notice ? { notice } : {}) });
      } catch (llmErr) {
        if (provider.name === "stub") throw llmErr;
        console.warn(`[coach] ${provider.name} failed:`, llmErr instanceof Error ? llmErr.message.slice(0, 160) : llmErr);
        failed.push(provider.name === "gemini" ? "Gemini" : "OpenRouter");
      }
    }
    return NextResponse.json({ error: "no LLM provider available" }, { status: 502 });
  } catch (e) {
    if (e instanceof NessieError) return NextResponse.json({ error: e.message }, { status: 503 });
    console.error("[coach]", e);
    const msg = e instanceof Error ? e.message : "coach failed";
    return NextResponse.json({ error: msg, hint: /429|quota|rate/i.test(msg) ? "LLM rate limited; set LLM_PROVIDER=stub for a deterministic narrator" : undefined }, { status: 502 });
  }
}
