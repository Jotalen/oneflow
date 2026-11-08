import { CONTEXT_SENTINEL, type LlmProvider, type LlmTurn, type Msg, type ToolDef } from "./provider";
import type { CoachContext } from "./prompt";

/** Deterministic narrator (ADR-003). Reads the context JSON, calls two tools once, then quotes numbers verbatim. */
export class StubProvider implements LlmProvider {
  readonly name = "stub" as const;

  async chat(messages: Msg[], tools: ToolDef[]): Promise<LlmTurn> {
    const ctx = readContext(messages);
    const user = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const hasToolResults = messages.some((m) => m.role === "tool");
    if (!ctx) return { text: "I don't have your picture loaded yet. Pick a persona and try again.\nNext step: Self-service" };
    if (tools.length && !hasToolResults && ctx.topMoves[0]) {
      return { toolCalls: [{ id: "s1", name: "get_health", args: {} }, { id: "s2", name: "simulate_move", args: { moveId: ctx.topMoves[0].id } }] };
    }
    return { text: /analy[sz]e|brief|summar/i.test(user) ? brief(ctx) : answer(ctx, user) };
  }
}

function readContext(messages: Msg[]): CoachContext | null {
  const m = messages.find((x) => x.role === "system" && x.content.startsWith(CONTEXT_SENTINEL));
  if (!m) return null;
  try { return JSON.parse(m.content.slice(CONTEXT_SENTINEL.length)) as CoachContext; } catch { return null; }
}

const stepLabel = (s: string) => (/offer/i.test(s) ? "Eligible offer" : /follow/i.test(s) ? "Follow-up" : "Self-service");

function handoff(ctx: CoachContext): string {
  return [
    `${ctx.name}, the right next move is a conversation with a hardship specialist today, not a product.`,
    `Why: ${ctx.guardrailReasons.filter((r) => !/consent/i.test(r)).join("; ").toLowerCase()}.`,
    "A specialist can look at a deferral or a due-date change with you. Nothing here is a sales pitch, and nothing is final until you talk to a person.",
    "Next step: Follow-up",
  ].join("\n");
}

function brief(ctx: CoachContext): string {
  if (ctx.humanHandoff) return handoff(ctx);
  const [top, ...rest] = ctx.topMoves;
  const lines = [
    `${ctx.name}, your best next move is **${top.title}**: ${top.impact} ${top.impactKind === "netWorth" ? "to your net worth by month 24" : top.impactKind === "fees" ? "in avoided fees (estimate)" : "in estimated value"}.`,
    top.why,
  ];
  if (top.tfs?.assumption) lines.push(`Assumption: ${top.tfs.assumption}`);
  if (rest.length) lines.push(`Alternatives: ${rest.slice(0, 2).map((m) => `${m.title} (${m.impact})`).join("; ")}.`);
  if (top.tfs?.tradeoff) lines.push(`Trade-off: ${top.tfs.tradeoff}`);
  lines.push(`Runway ${ctx.health.runwayMonths} months, debt-to-income ${ctx.health.dtiPct}%.`);
  lines.push("Synthetic data; not financial advice.");
  lines.push(`Next step: ${stepLabel(top.nextStep)}`);
  return lines.join("\n");
}

function answer(ctx: CoachContext, user: string): string {
  if (ctx.humanHandoff) return handoff(ctx);
  const car = ctx.topMoves.find((m) => m.kind === "car");
  const bank = ctx.topMoves.find((m) => m.kind === "bank");
  const pick = /lease|car|toyota|buy|refi|trade|payment/i.test(user) && car ? car : /sav|card|debt|subscri|bank|runway/i.test(user) && bank ? bank : ctx.topMoves[0];
  const lines = [
    `${pick.title}: ${pick.impact}${pick.impactKind === "netWorth" ? " by month 24" : ""}.`,
    pick.why,
  ];
  if (pick.tfs?.tradeoff) lines.push(`Trade-off: ${pick.tfs.tradeoff}`);
  const alt = ctx.topMoves.find((m) => m.id !== pick.id);
  if (alt) lines.push(`Alternative: ${alt.title} (${alt.impact}).`);
  lines.push(`Next step: ${stepLabel(pick.nextStep)}`);
  return lines.join("\n");
}
