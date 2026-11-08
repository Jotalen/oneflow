import fs from "node:fs";
import path from "node:path";
import type { Analysis } from "@/lib/engine/analyze";
import { guardrails } from "@/lib/engine/guardrails";
import { fmtUSD } from "@/lib/money";
import { buildBankView } from "@/lib/bank/view";
import { CONTEXT_SENTINEL, type Msg } from "./provider";

const STARTER = fs.readFileSync(path.join(process.cwd(), "data", "toyota", "starter_system_prompt.txt"), "utf8").trim();

export const NO_ARITHMETIC_RULE = `
Additional NextMove rules:
A. You may not add, subtract, multiply, divide, or estimate numbers. Quote dollar amounts and percentages exactly as they appear in the context or tool results.
B. The ranked moves and their impacts come from a deterministic engine. Do not re-rank them; explain them.
C. Prefer tools: get_health, simulate_move, get_car_options, run_projection, get_profile. execute_move only when the customer explicitly asks to do it.
D. Lead with topMoves[0], the engine's number-one move, so you agree with the Next best move card. Then address what the customer says.
E. For runway or emergency-fund questions, quote safetyNetMonths (cash divided by monthly essentials, the number on the Safety net page).
F. Keep answers under 160 words. End with exactly one line: "Next step: Self-service" | "Next step: Follow-up" | "Next step: Eligible offer".`;

export const SYSTEM_PROMPT = `${STARTER}\n${NO_ARITHMETIC_RULE}`;

/** Compact, number-safe context the model can quote from (also what the stub narrates). */
export function contextFor(a: Analysis) {
  const g = guardrails(a.profile);
  return {
    persona: a.profile.personaId,
    name: a.profile.name,
    age: a.profile.age,
    says: a.profile.situation?.says ?? "",
    humanHandoff: g.humanHandoff,
    guardrailReasons: g.reasons,
    car: a.profile.car ? `${a.profile.car.year} ${a.profile.car.model}` : null,
    contract: a.profile.contract ? { type: a.profile.contract.type, monthsRemaining: a.profile.contract.monthsRemaining, payment: fmtUSD(a.profile.contract.monthlyPayment) } : null,
    health: a.health,
    safetyNetMonths: buildBankView(a).safetyNet.months,
    topMoves: a.ranked.slice(0, 4).map((m) => ({ id: m.id, title: m.title, kind: m.kind, impact: fmtUSD(m.impact24), impactKind: m.impactKind, nextStep: m.nextStep ?? m.tfs?.nextStepType ?? "Self-service", why: m.why, goldenMatch: m.goldenMatch, tfs: m.tfs ? { optionId: m.tfs.optionId, assumption: m.tfs.assumption, tradeoff: m.tfs.tradeoff } : null })),
  };
}
export type CoachContext = ReturnType<typeof contextFor>;

export function systemMessages(a: Analysis): Msg[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: `${CONTEXT_SENTINEL}${JSON.stringify(contextFor(a))}` },
  ];
}
