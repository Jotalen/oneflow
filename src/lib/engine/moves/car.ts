import type { OptionScenario, ToyotaData } from "@/lib/toyota/types";
import { guardrails, NEW_VEHICLE_OPTIONS } from "../guardrails";
import type { Contract, Move, MoveTfs, Profile } from "../types";

const LEASE_END_OPTIONS = new Set(["RETURN", "BUYOUT", "RENEW", "EXTENDLEASE"]);
const KEEP_CAR_OPTIONS = new Set(["BUYOUT", "RENEW", "EXTENDLEASE"]);
const FOLLOW_UP_OPTIONS = new Set(["DEFER", "RELOCATE", "EARLYEND"]);
const SELF_SERVICE_OPTIONS = new Set(["DUEDATE", "SERVICE", "EXTRA100"]);
const EXTEND_MONTHS = 12;
const EXTEND_LEASE_MONTHS = 6;
const BUYOUT_LOAN_TERM = 48;
const RENEW_LEASE_TERM = 36;

const eligible = (o: OptionScenario) => /^(Y|Review)/i.test(o.eligibility);

function refiApr(t: ToyotaData, tier: string, months: number): number | undefined {
  const rows = t.rates.filter((r) => r.credit_tier === tier).sort((a, b) => a.term_months - b.term_months);
  return (rows.find((r) => r.term_months >= months) ?? rows[rows.length - 1])?.refinance_apr;
}

function tfsOf(o: OptionScenario, t: ToyotaData): MoveTfs {
  const offer = t.offers.find((x) => x.offer_id === o.option_id);
  const nextStepType = FOLLOW_UP_OPTIONS.has(o.option_id) || /^Review/i.test(o.eligibility) ? "Follow-up" : SELF_SERVICE_OPTIONS.has(o.option_id) ? "Self-service" : offer?.next_step_type ?? "Offer";
  return {
    optionId: o.option_id,
    eligibility: o.eligibility,
    tfsTotalVsKeep: o.total_cost_vs_keep_as_is,
    nextStepType,
    plainSummary: o.plain_language_summary,
    assumption: o.key_assumption,
    tradeoff: o.tradeoff,
  };
}

/** Map a TFS option onto projection overrides. Approximations are labeled in `why`. */
function overridesFor(o: OptionScenario, p: Profile, t: ToyotaData): { overrides: Record<string, unknown>; impactKind: Move["impactKind"]; fixedImpact24?: number } {
  const c = p.contract!;
  const id = o.option_id;
  const newPay = o.new_monthly_payment ?? c.monthlyPayment;
  const upfront = o.upfront_cost ?? 0;
  const repl = (patch: Partial<Contract>): Contract => ({ ...c, ...patch });

  if (c.type === "lease") {
    if (id === "RETURN") return { overrides: {}, impactKind: "netWorth" }; // this IS the do-nothing baseline
    if (id === "BUYOUT") {
      const payoff = upfront || c.payoffQuote;
      return { overrides: { keepCarAfterLease: true, contractReplacement: repl({ type: "loan", balance: payoff, payoffQuote: payoff, monthlyPayment: newPay || Math.round(payoff / BUYOUT_LOAN_TERM), monthsRemaining: BUYOUT_LOAN_TERM, aprPct: refiApr(t, p.creditTier, BUYOUT_LOAN_TERM) ?? 7.9, leaseEndFees: 0 }) }, impactKind: "netWorth" };
    }
    if (id === "RENEW") return { overrides: { keepCarAfterLease: true, contractReplacement: repl({ monthlyPayment: newPay, monthsRemaining: RENEW_LEASE_TERM, balance: newPay * RENEW_LEASE_TERM, leaseEndFees: 0 }), oneTimeExpense: { month: 1, amount: upfront } }, impactKind: "netWorth" };
    if (id === "EXTENDLEASE") return { overrides: { contractReplacement: repl({ monthlyPayment: newPay, monthsRemaining: c.monthsRemaining + EXTEND_LEASE_MONTHS, balance: c.balance + newPay * EXTEND_LEASE_MONTHS }) }, impactKind: "netWorth" };
    if (id === "EARLYEND") return { overrides: { contractReplacement: null, oneTimeExpense: { month: 1, amount: upfront } }, impactKind: "netWorth" };
    if (id === "RELOCATE") return { overrides: {}, impactKind: "risk", fixedImpact24: -(o.total_cost_vs_keep_as_is ?? 0) };
  } else {
    if (id === "REFI") return { overrides: { contractReplacement: repl({ monthlyPayment: newPay, aprPct: refiApr(t, p.creditTier, c.monthsRemaining) ?? c.aprPct }) }, impactKind: "netWorth" };
    if (id === "EXTEND") return { overrides: { contractReplacement: repl({ monthlyPayment: newPay, monthsRemaining: c.monthsRemaining + EXTEND_MONTHS }) }, impactKind: "netWorth" };
    if (id === "EXTRA100") return { overrides: { extraToDebtMonthly: Math.max(0, newPay - c.monthlyPayment), extraToDebtTargetId: "contract" }, impactKind: "netWorth" };
    if (id === "DEFER") return { overrides: {}, impactKind: "risk", fixedImpact24: -(o.total_cost_vs_keep_as_is ?? 0) };
    // Equity is already in net worth; a trade-in does not create it. Rank TRADE on TFS cost only (blank → 0).
    if (id === "TRADE") return { overrides: {}, impactKind: "risk", fixedImpact24: -(o.total_cost_vs_keep_as_is ?? 0) };
    if (id === "DUEDATE") return { overrides: {}, impactKind: "fees", fixedImpact24: 0 };
  }
  if (id === "SERVICE") return { overrides: { oneTimeExpense: { month: 1, amount: upfront } }, impactKind: "risk", fixedImpact24: -upfront };
  return { overrides: {}, impactKind: "risk", fixedImpact24: -(o.total_cost_vs_keep_as_is ?? 0) };
}

export function humanMove(p: Profile, t: ToyotaData): Move {
  const g = guardrails(p);
  const offer = t.offers.find((x) => x.offer_id === "HUMAN");
  return {
    id: "human",
    kind: "human",
    title: "Talk to a hardship specialist today",
    why: `${g.reasons.join(". ")}. No offers, no upsell: a person will walk through options with you.`,
    impactKind: "risk",
    nextStep: "Follow-up",
    overrides: {},
    tfs: { optionId: "HUMAN", eligibility: "Y", tfsTotalVsKeep: null, nextStepType: "Follow-up", plainSummary: offer?.eligibility_rule_summary ?? "Vulnerable or distressed customers are routed to a specialist.", assumption: "", tradeoff: "" },
  };
}

/** Car moves from TFS option scenarios, filtered by eligibility and the Toyota guardrails. */
export function carMoves(p: Profile, t: ToyotaData): Move[] {
  if (!p.contract || !p.car) return [];
  const g = guardrails(p);
  if (g.humanHandoff) return [humanMove(p, t)];
  return p.carOptions
    .filter((o) => o.option_id !== "KEEP" && eligible(o))
    .filter((o) => !(g.noNewVehicleOffers && NEW_VEHICLE_OPTIONS.has(o.option_id)))
    .map((o) => {
      const { overrides, impactKind, fixedImpact24 } = overridesFor(o, p, t);
      const tfs = tfsOf(o, t);
      return {
        id: `car:${o.option_id}`,
        kind: "car" as const,
        title: o.option_name,
        why: o.plain_language_summary,
        impactKind,
        nextStep: tfs.nextStepType as Move["nextStep"],
        overrides,
        fixedImpact24,
        tfs,
      };
    });
}
