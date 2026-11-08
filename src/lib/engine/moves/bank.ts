import { fmtUSD } from "@/lib/money";
import { essentialMonthly, liquidTotal, takeHome } from "../cashflow";
import { health } from "../health";
import { OVERDRAFT_FEE } from "../project";
import type { Move, Profile } from "../types";

export const RUNWAY_TARGET_MONTHS = 3;
export const IDLE_CASH_MONTHS = 6;
export const CD_APY_PCT = 4.0;
export const EXTRA_DEBT_SHARE_OF_TAKE_HOME = 0.1;
export const MIN_EXTRA_DEBT = 2_500;
export const OVERDRAFTS_AVOIDED_PER_YEAR = 2;
export const AUTOPAY_VALUE_PER_YEAR = 1_800; // VD_AUTOPAY $18/yr
export const HORIZON_YEARS = 2;

function payHighestApr(p: Profile): Move | null {
  const target = p.debts.filter((d) => d.aprPct > 0 && d.balance > 0).sort((a, b) => b.aprPct - a.aprPct)[0];
  if (!target) return null;
  const extra = Math.max(MIN_EXTRA_DEBT, Math.min(Math.round(takeHome(p) * EXTRA_DEBT_SHARE_OF_TAKE_HOME), Math.round(target.balance / 12)));
  return {
    id: "pay_highest_apr",
    kind: "bank",
    title: `Put ${fmtUSD(extra)}/mo extra toward ${target.label}`,
    why: `${target.label} charges ${target.aprPct}% APR, your highest. Extra principal cuts interest first.`,
    impactKind: "netWorth",
    nextStep: "Bank",
    overrides: { extraToDebtMonthly: extra },
    // Cards are payable in Nessie; Toyota loans have no payment endpoint, so loan extra is set aside in savings.
    execution: target.kind === "card"
      ? [{ op: "transfer", from: "checking", to: "card", amount: extra, description: `Card payment: ${target.label}` }]
      : [{ op: "transfer", from: "checking", to: "savings", amount: extra, description: `Set aside for extra principal: ${target.label}` }],
  };
}

function buildRunway(p: Profile): Move | null {
  const h = health(p);
  if (h.runwayMonths >= RUNWAY_TARGET_MONTHS) return null;
  const gap = RUNWAY_TARGET_MONTHS * essentialMonthly(p) - liquidTotal(p);
  const monthly = Math.max(MIN_EXTRA_DEBT, Math.min(Math.round(takeHome(p) * EXTRA_DEBT_SHARE_OF_TAKE_HOME), Math.round(gap / 12)));
  return {
    id: "build_runway_3mo",
    kind: "bank",
    title: `Move ${fmtUSD(monthly)}/mo to savings until you have 3 months of runway`,
    why: `You have ${h.runwayMonths} months of essential spending covered. Three is the floor before anything else.`,
    impactKind: "risk",
    nextStep: "Bank",
    overrides: { savingsTransferMonthly: monthly },
    execution: [{ op: "transfer", from: "checking", to: "savings", amount: monthly, description: "Runway: automatic savings" }],
  };
}

function idleCashToCd(p: Profile): Move | null {
  if (p.accounts.some((a) => a.kind === "cd")) return null;
  const savings = p.accounts.filter((a) => a.kind === "savings").reduce((s, a) => s + a.available, 0);
  const idle = savings - IDLE_CASH_MONTHS * essentialMonthly(p);
  if (idle <= 0) return null;
  const yieldOverHorizon = Math.round((idle * CD_APY_PCT * HORIZON_YEARS) / 100);
  return {
    id: "idle_cash_to_cd",
    kind: "bank",
    title: `Move ${fmtUSD(idle)} of idle savings into a 12-month CD`,
    why: `Savings beyond ${IDLE_CASH_MONTHS} months of essentials earns nothing. A CD at ${CD_APY_PCT}% APY adds ${fmtUSD(yieldOverHorizon)} over two years.`,
    impactKind: "netWorth",
    nextStep: "Bank",
    overrides: {},
    fixedImpact24: yieldOverHorizon,
    execution: [{ op: "openCd", amount: idle }],
  };
}

function cancelRecurring(p: Profile): Move | null {
  const subs = p.bills.filter((b) => b.status === "recurring" && b.isSubscription && !/t-mobile|verizon|at&t/i.test(b.payee));
  if (subs.length === 0) return null;
  const total = subs.reduce((s, b) => s + b.amount, 0);
  return {
    id: "cancel_recurring",
    kind: "bank",
    title: `Cancel ${subs.length} subscription${subs.length > 1 ? "s" : ""} (${fmtUSD(total)}/mo)`,
    why: `${subs.map((b) => b.payee).join(", ")} recur every month. Cancelling frees ${fmtUSD(total * 12)} a year.`,
    impactKind: "netWorth",
    nextStep: "Bank",
    overrides: { cancelBillIds: subs.map((b) => b.id) },
    execution: subs.map((b) => ({ op: "cancelBill" as const, billId: b.id })),
  };
}

/** Checking that covers the car payment plus this many months of essentials is not at overdraft risk. */
export const DUE_DATE_SAFE_CUSHION_MONTHS = 1;

function dueDateToPayday(p: Profile): Move | null {
  if (!p.contract || p.contract.dueDay >= p.paydayDay) return null; // paycheck already lands first
  const checking = p.accounts.filter((a) => a.kind === "checking").reduce((s, a) => s + a.available, 0);
  if (checking >= p.contract.monthlyPayment + DUE_DATE_SAFE_CUSHION_MONTHS * essentialMonthly(p)) return null;
  return {
    id: "due_date_to_payday",
    kind: "bank",
    title: `Move your Toyota due date from the ${ordinal(p.contract.dueDay)} to the ${ordinal(p.paydayDay)}`,
    why: `Your payment is due before your paycheck lands. Aligning them avoids overdrafts.`,
    impactKind: "fees",
    nextStep: "Self-service",
    overrides: {},
    fixedImpact24: OVERDRAFT_FEE * OVERDRAFTS_AVOIDED_PER_YEAR * HORIZON_YEARS,
  };
}

function setAutopay(p: Profile): Move | null {
  if (!p.contract || p.flags.autopay) return null;
  // A recurring Toyota bill already pays it (e.g. this move was accepted): another would pay twice.
  if (p.bills.some((b) => b.isVehiclePayment && b.status === "recurring")) return null;
  return {
    id: "set_autopay",
    kind: "bank",
    title: "Turn on autopay for your Toyota payment",
    why: "Never miss a due date; Toyota values autopay customers and it protects your credit tier.",
    impactKind: "risk",
    nextStep: "Self-service",
    overrides: {},
    fixedImpact24: AUTOPAY_VALUE_PER_YEAR * HORIZON_YEARS,
    // TFS offer AUTOPAY (offers_catalog: "Enroll in autopay", eligible when autopay = N, checked above).
    tfs: { optionId: "AUTOPAY", eligibility: "Y", tfsTotalVsKeep: null, nextStepType: "Self-service", plainSummary: "Enroll in autopay", assumption: "", tradeoff: "" },
    execution: [{ op: "createBill", payee: "Toyota Financial Services", amount: p.contract.monthlyPayment, recurringDay: p.contract.dueDay, nickname: "TFS autopay" }],
  };
}

const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4) % 4] ?? "th"}`;

/** Bank-side rules. Pure; order here is not the final rank. */
export function bankMoves(p: Profile): Move[] {
  return [payHighestApr(p), buildRunway(p), idleCashToCd(p), cancelRecurring(p), dueDateToPayday(p), setAutopay(p)].filter((m): m is Move => m !== null);
}
