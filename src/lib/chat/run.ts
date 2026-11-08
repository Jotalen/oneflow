import type { LlmProvider, LlmTurn, Msg, ToolDef } from "@/lib/llm/provider";
import { factsFor, type AutoBuyProposal, type ChatCtx } from "./facts";

const FACTS_TAG = "FACTS:";

const SYSTEM = `You are Ask AI inside OneFlow, the customer's bank. FACTS holds their complete account: balances, pending holds, paychecks, bills, card and car details, rewards, credit, budget, recent transactions, plus any calculations for this question.
Rules:
1. Use only numbers that appear in FACTS and quote them exactly. Never calculate, round or estimate. Percents and APRs take "%" only, never "$".
2. Speak as their bank: warm, direct and specific. Never use the words sample, demo, test, synthetic or generated.
3. Toyota prices are Toyota's starting MSRP. When a rate says "Toyota offer", say it's Toyota's current offer and when it ends; otherwise call it the standard TFS rate for their credit. If they ask about a model, lead with that model.
4. Solana: give the verdict and the reasons. If FACTS has solanaAutoBuy and the verdict isn't "no", tell them to tap "Set up auto-buy" below. They approve every buy in Phantom.
5. If account.needsSpecialist is true, recommend a Toyota Financial Services specialist and don't encourage buying or investing.
6. Format: one plain sentence that answers, then at most 5 short bullets with the key numbers in **bold**. Under 120 words. No headings.`;

export interface ChatResult { text: string; provider: string; topics: string[]; proposal?: AutoBuyProposal }

/** One model call: the whole account and this question's calculations go in, the model only words them. */
export async function runChat(ctx: ChatCtx, message: string, provider: LlmProvider, history: Msg[] = []): Promise<ChatResult> {
  const f = factsFor(ctx, message);
  const facts = { account: f.account, ...f.extra };
  const messages: Msg[] = [{ role: "system", content: SYSTEM }, { role: "system", content: `${FACTS_TAG}${JSON.stringify(facts)}` }, ...history, { role: "user", content: message }];
  const turn = await provider.chat(messages, []);
  if (!turn.text?.trim()) throw new Error(`${provider.name} returned no text`);
  return { text: turn.text.trim(), provider: provider.name, topics: f.topics, proposal: f.proposal };
}

type R = Record<string, unknown>;
const list = (xs: unknown) => (Array.isArray(xs) ? (xs as R[]) : []);

function carText(t: R): string {
  const offers = [...list(t.askedAbout), ...list(t.otherGoodFits), ...list(t.closestOptions)].slice(0, 4);
  const line = (o: R) => `• **${o.model}**: **${o.monthly}/mo** at ${o.aprPct}% for ${o.termMonths} months with ${o.down} down (${o.rate})${o.affordable ? "" : `. ${list(o.why).join(" ")}`}`;
  return [offers.some((o) => o.affordable) ? "Here's what fits your budget right now:" : "These don't fit comfortably yet:", ...offers.map(line)].join("\n");
}

function planText(p: R): string {
  const low = p.lowestPoint as R;
  const items = list(p.items).slice(0, 6).map((i) => `• ${i.date}: ${i.what} **${i.amount}**, checking ${i.checkingAfter}`);
  return [p.comesUpShort ? `Heads up: checking dips to **${low.checking}** on ${low.date}.` : `Every bill is covered. Your lowest point is **${low.checking}** on ${low.date}.`, ...items].join("\n");
}

function solanaText(s: R): string {
  const head = s.verdict === "yes" ? "Yes, that fits your budget." : s.verdict === "caution" ? "You can, but there's a better first step." : "Not right now.";
  return [head, `• **${s.perPaycheck}** each payday (**${s.monthly}/mo**), leaving **${s.leftoverAfter}** a month`, ...list(s.reasons).map((r) => `• ${String(r)}`), s.verdict === "no" ? "" : '• Tap "Set up auto-buy" below; you approve each buy in Phantom.'].filter(Boolean).join("\n");
}

function narrate(facts: R): string {
  const a = facts.account as R;
  if (a.needsSpecialist) return "Let's start with a Toyota Financial Services specialist. They can look at a due-date change or a deferral with you before anything else.";
  if (facts.solanaAutoBuy) return solanaText(facts.solanaAutoBuy as R);
  if (facts.toyota) return carText(facts.toyota as R);
  if (facts.paymentPlan) return planText(facts.paymentPlan as R);
  const inc = a.income as R;
  const move = list(a.nextBestMoves)[0];
  return [`You're paid **${inc.perPaycheck}** per paycheck, next on ${inc.nextPayday}.`, move ? `• Your best move: **${move.title}** (${move.impactBy24Months} over 24 months)` : ""].filter(Boolean).join("\n");
}

/** Built-in answer when no model is reachable: same FACTS, fixed wording, instant. */
export class ChatStub implements LlmProvider {
  readonly name = "stub" as const;
  async chat(messages: Msg[], tools: ToolDef[]): Promise<LlmTurn> {
    void tools;
    const raw = messages.find((m) => m.role === "system" && m.content.startsWith(FACTS_TAG))?.content.slice(FACTS_TAG.length) ?? "{}";
    return { text: narrate(JSON.parse(raw) as R) };
  }
}
