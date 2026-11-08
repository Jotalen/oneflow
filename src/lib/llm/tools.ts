import type { Analysis } from "@/lib/engine/analyze";
import { guardrails } from "@/lib/engine/guardrails";
import { fmtUSD } from "@/lib/money";
import type { ToolDef } from "./provider";

export interface ToolCtx { analysis: Analysis; execute?: (moveId: string) => Promise<unknown> }

export const TOOL_DEFS: ToolDef[] = [
  { name: "get_profile", description: "The customer's accounts, debts, bills, car and contract (no transactions).", parameters: { type: "object", properties: {} } },
  { name: "get_health", description: "The 8 financial-health indicators computed by the engine.", parameters: { type: "object", properties: {} } },
  { name: "run_projection", description: "24-month do-nothing projection: net worth at months 0, 6, 12, 18, 24 and events.", parameters: { type: "object", properties: {} } },
  { name: "simulate_move", description: "Impact of one ranked move by id: dollar impact at month 24 and the TFS estimate.", parameters: { type: "object", properties: { moveId: { type: "string", description: "Move id from the ranked list" } }, required: ["moveId"] } },
  { name: "get_car_options", description: "Eligible Toyota options with TFS plain-language summary, assumption and trade-off.", parameters: { type: "object", properties: {} } },
  { name: "execute_move", description: "Ask the customer to confirm a bank-side move. Returns confirmRequired; the customer presses Accept in the app. Refused for vulnerable customers.", parameters: { type: "object", properties: { moveId: { type: "string" } }, required: ["moveId"] } },
];

const SAMPLE_MONTHS = [0, 6, 12, 18, 24];

export async function runTool(name: string, args: Record<string, unknown>, ctx: ToolCtx): Promise<unknown> {
  const { analysis: a } = ctx;
  switch (name) {
    case "get_profile": {
      const p = a.profile;
      // Every money field formatted (prompt rule A: the model quotes verbatim, so never hand it raw cents).
      return {
        personaId: p.personaId, name: p.name, age: p.age, creditTier: p.creditTier, paydayDay: p.paydayDay,
        incomeMonthly: fmtUSD(p.incomeMonthly),
        accounts: p.accounts.map((x) => ({ nickname: x.nickname, kind: x.kind, balance: fmtUSD(x.balance), available: fmtUSD(x.available), creditLimit: x.creditLimit ? fmtUSD(x.creditLimit) : null })),
        debts: p.debts.map((d) => ({ label: d.label, kind: d.kind, balance: fmtUSD(d.balance), aprPct: d.aprPct, payment: fmtUSD(d.monthlyPayment), monthsRemaining: d.monthsRemaining ?? null })),
        bills: p.bills.map((b) => ({ payee: b.payee, amount: fmtUSD(b.amount), dueDay: b.dueDay ?? null, status: b.status, isSubscription: b.isSubscription })),
        car: p.car ? { model: `${p.car.year} ${p.car.model} ${p.car.trim}`, marketValue: fmtUSD(p.car.marketValue), odometer: p.car.odometer, toyotaCareEnds: p.car.toyotaCareEnds, nextServiceDue: p.car.nextServiceDue, openRecall: p.car.openRecall } : null,
        contract: p.contract ? { type: p.contract.type, monthsRemaining: p.contract.monthsRemaining, payment: fmtUSD(p.contract.monthlyPayment), payoffQuote: fmtUSD(p.contract.payoffQuote), estEquity: fmtUSD(p.contract.estEquity), aprPct: p.contract.aprPct ?? null, dueDay: p.contract.dueDay, missedPayments12m: p.contract.missedPayments12m } : null,
        flags: p.flags,
      };
    }
    case "get_health":
      return a.health;
    case "run_projection": {
      const base = a.ranked[0]?.baseline;
      if (!base) return { error: "no projection" };
      return { points: base.points.filter((p) => SAMPLE_MONTHS.includes(p.month)).map((p) => ({ month: p.month, netWorth: fmtUSD(p.netWorth), liquid: fmtUSD(p.liquid), events: p.events })), netWorth24: fmtUSD(base.netWorth24) };
    }
    case "simulate_move": {
      const m = a.ranked.find((x) => x.id === String(args.moveId));
      if (!m) return { error: `unknown move ${String(args.moveId)}`, knownIds: a.ranked.map((x) => x.id) };
      return { id: m.id, title: m.title, impactFmt: fmtUSD(m.impact24), impactKind: m.impactKind, baselineNetWorth24: fmtUSD(m.baseline.netWorth24), appliedNetWorth24: fmtUSD(m.applied.netWorth24), tfs: m.tfs ?? null, goldenMatch: m.goldenMatch };
    }
    case "get_car_options":
      return a.ranked.filter((m) => m.kind === "car" || m.kind === "human").map((m) => ({ id: m.id, title: m.title, impactFmt: fmtUSD(m.impact24), nextStep: m.tfs?.nextStepType, eligibility: m.tfs?.eligibility, summary: m.tfs?.plainSummary, assumption: m.tfs?.assumption, tradeoff: m.tfs?.tradeoff, goldenMatch: m.goldenMatch }));
    case "execute_move": {
      const g = guardrails(a.profile);
      if (g.humanHandoff) return { refused: true, reason: `Guardrail: ${g.reasons.join("; ")}. Route to a human specialist instead.` };
      const m = a.ranked.find((x) => x.id === String(args.moveId));
      if (!m) return { error: `unknown move ${String(args.moveId)}` };
      if (!m.execution?.length) return { error: "this move has no bank-side execution" };
      // The model never moves money (ADR-003). The customer confirms with the Accept button.
      return { confirmRequired: true, moveId: m.id, title: m.title, hint: "Tell the customer to press Accept on this move card to execute it in the bank." };
    }
    default:
      return { error: `unknown tool ${name}` };
  }
}
