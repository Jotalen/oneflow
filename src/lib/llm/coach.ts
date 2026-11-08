import type { Analysis } from "@/lib/engine/analyze";
import { systemMessages } from "./prompt";
import type { LlmProvider, Msg } from "./provider";
import { StubProvider } from "./stub";
import { runTool, TOOL_DEFS, type ToolCtx } from "./tools";

/** Per-model budget for a whole coach run (tool calls included); past it the next provider answers. */
export const COACH_PROVIDER_TIMEOUT_MS = 30_000;

export const MAX_TOOL_CALLS = 4;
const ANALYZE_PROMPT = "Analyze my whole picture and brief me on my next best move, with one or two alternatives and the trade-offs.";

export interface CoachResult { text: string; toolTrace: string[]; provider: string }

/** Tool loop (ADR-003): at most MAX_TOOL_CALLS tool calls in total, then the model must answer in text. */
export async function runCoach(analysis: Analysis, userMessage: string, provider: LlmProvider, ctx: Partial<ToolCtx> = {}, history: Msg[] = []): Promise<CoachResult> {
  const toolCtx: ToolCtx = { analysis, ...ctx };
  const messages: Msg[] = [...systemMessages(analysis), ...history, { role: "user", content: userMessage }];
  const toolTrace: string[] = [];

  while (toolTrace.length < MAX_TOOL_CALLS) {
    const turn = await provider.chat(messages, TOOL_DEFS);
    if (!turn.toolCalls?.length) {
      if (turn.text) return { text: turn.text, toolTrace, provider: provider.name };
      break;
    }
    const calls = turn.toolCalls.slice(0, MAX_TOOL_CALLS - toolTrace.length);
    messages.push({ role: "assistant", content: turn.text ?? "", toolCalls: calls });
    for (const call of calls) {
      const result = await runTool(call.name, call.args, toolCtx);
      toolTrace.push(`${call.name}(${JSON.stringify(call.args)})`);
      messages.push({ role: "tool", name: call.name, toolCallId: call.id, content: JSON.stringify(result) });
    }
  }
  // Out of rounds (or empty answer): force a text answer with no tools; fall back to the stub narrator.
  const final = await provider.chat([...messages, { role: "system", content: "Answer now in plain text using the tool results above. No more tool calls." }], []);
  if (final.text) return { text: final.text, toolTrace, provider: provider.name };
  const stub = await new StubProvider().chat([...systemMessages(analysis), { role: "tool", name: "noop", content: "{}" }, { role: "user", content: userMessage }], []);
  return { text: stub.text ?? "I could not produce an answer.\nNext step: Follow-up", toolTrace, provider: `${provider.name}→stub` };
}

export interface AnalyzeResult extends CoachResult { brief: string; rankedIds: string[]; tileOrder: string[] }

/** "AI analyze": narrate the engine's ranking. Order comes from the engine, never the model (ADR-003). */
export async function coachAnalyze(analysis: Analysis, provider: LlmProvider, ctx: Partial<ToolCtx> = {}): Promise<AnalyzeResult> {
  const r = await runCoach(analysis, ANALYZE_PROMPT, provider, ctx);
  return { ...r, brief: r.text, rankedIds: analysis.ranked.map((m) => m.id), tileOrder: analysis.tiles };
}
