import { NextResponse } from "next/server";
import { NessieError } from "@/lib/nessie/client";
import { getAnalysis, knownPersona } from "@/lib/server/analysis";
import { GeminiProvider } from "@/lib/llm/gemini";
import { OpenRouterProvider } from "@/lib/llm/openrouter";
import type { LlmProvider } from "@/lib/llm/provider";
import type { Msg } from "@/lib/llm/provider";
import { withTimeout } from "@/lib/llm/timeout";
import { buildBankView } from "@/lib/bank/view";
import { AS_OF } from "@/lib/engine/types";
import { loadToyota } from "@/lib/toyota/load";
import { ChatStub, runChat, type ChatResult } from "@/lib/chat/run";
import type { ChatCtx } from "@/lib/chat/facts";

const MAX_HISTORY = 10;
const MAX_MESSAGE_CHARS = 1_000;
/** Whole answer within ~5s: models share this budget, then the built-in answer (instant) takes over. */
const ANSWER_BUDGET_MS = 4_500;
/** If Gemini hasn't answered by then, OpenRouter starts too and the first good answer wins. */
const HEDGE_AFTER_MS = 1_800;
/** Fastest Gemini models on our prompts (Nov 8 benchmark: ~0.85s and ~0.97s). */
const CHAT_MODEL = "gemini-3.5-flash-lite";
const CHAT_FALLBACK_MODELS = ["gemini-flash-lite-latest"];

function chatModels(): LlmProvider[] {
  const want = (process.env.LLM_PROVIDER ?? "stub").toLowerCase();
  if (want === "stub") return [];
  return [
    ...(process.env.GEMINI_API_KEY && want !== "openrouter" ? [new GeminiProvider(process.env.GEMINI_API_KEY, CHAT_MODEL, CHAT_FALLBACK_MODELS)] : []),
    ...(process.env.OPENROUTER_API_KEY ? [new OpenRouterProvider(process.env.OPENROUTER_API_KEY)] : []),
  ];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * First good answer from the models, each starting HEDGE_AFTER_MS after the previous one, all cut off
 * at the deadline. Resolves null when none answers in time.
 */
async function firstAnswer(models: LlmProvider[], run: (p: LlmProvider) => Promise<ChatResult>, budgetMs: number): Promise<ChatResult | null> {
  if (!models.length) return null;
  const attempts = models.map(async (p, i) => {
    await sleep(i * HEDGE_AFTER_MS);
    try {
      return await withTimeout(run(p), Math.max(1, budgetMs - i * HEDGE_AFTER_MS), p.name);
    } catch (e) {
      console.warn(`[chat] ${p.name} failed:`, e instanceof Error ? e.message.slice(0, 160) : e);
      throw e;
    }
  });
  return Promise.any(attempts).catch(() => null);
}

/** POST { persona, message, history? } → Ask AI answer worded by Gemini (then OpenRouter, then the offline narrator). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { persona?: string; message?: string; history?: Msg[] } | null;
  if (!body?.persona || !knownPersona(body.persona)) return NextResponse.json({ error: "valid persona required" }, { status: 400 });
  const message = String(body.message ?? "").slice(0, MAX_MESSAGE_CHARS).trim();
  if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });
  const history: Msg[] = (body.history ?? []).filter((m) => m.role === "user" || m.role === "assistant").slice(-MAX_HISTORY).map((m) => ({ role: m.role, content: String(m.content).slice(0, MAX_MESSAGE_CHARS) }));

  try {
    const { analysis } = await getAnalysis(body.persona);
    const ctx: ChatCtx = { analysis, view: buildBankView(analysis), rates: loadToyota().rates, today: AS_OF };
    const answer = await firstAnswer(chatModels(), (p) => runChat(ctx, message, p, history), ANSWER_BUDGET_MS);
    return NextResponse.json(answer ?? (await runChat(ctx, message, new ChatStub(), history)));
  } catch (e) {
    if (e instanceof NessieError) return NextResponse.json({ error: "The bank is busy. Try again in a moment." }, { status: 503 });
    console.error("[chat]", e);
    return NextResponse.json({ error: "Ask AI couldn't answer. Try again." }, { status: 500 });
  }
}
