/**
 * Borrowing math for the car and house pages. Pure, deterministic, integer cents.
 * Rates come from the Toyota Financial Services hackathon rate sheet (RateRow).
 */
import { amortize, monthlyInterest } from "@/lib/engine/amortize";
import type { RateRow } from "@/lib/toyota/types";
import type { Cents } from "@/lib/money";
import { addMonths, payoffWithExtra } from "./view";

export type FinanceKind = "new" | "refi";

export interface FinanceOption { term: number; apr: number; monthly: Cents; totalInterest: Cents; totalPayments: Cents; bestFit: boolean; tierLabel: string }

/** Finance (or refinance) rows for one credit tier, cheapest total cost first; best fit = cheapest under the target payment. */
export function financeOptions(i: { amount: Cents; rates: RateRow[]; tier: string; kind: FinanceKind; targetMonthly: Cents }): FinanceOption[] {
  if (i.amount <= 0) return [];
  const rows = i.rates
    .filter((r) => r.credit_tier === i.tier)
    .map((r) => {
      const apr = i.kind === "new" ? r.new_purchase_apr : r.refinance_apr;
      const monthly = amortize(i.amount, apr, r.term_months);
      const totalPayments = monthly * r.term_months;
      return { term: r.term_months, apr, monthly, totalPayments, totalInterest: totalPayments - i.amount, bestFit: false, tierLabel: r.tier_label };
    })
    .sort((a, b) => a.totalPayments - b.totalPayments);
  const fitIdx = rows.findIndex((r) => r.monthly <= i.targetMonthly);
  return rows.map((r, idx) => (idx === fitIdx ? { ...r, bestFit: true } : r));
}

export interface ExtraPlan { months: number; baseMonths: number; monthsSaved: number; interest: Cents; interestSaved: Cents; paidOffDate: string; basePaidOffDate: string }

/** Paying `extra` more each month vs the schedule. */
export function extraPaymentPlan(i: { balance: Cents; aprPct: number; monthly: Cents; extra: Cents; nextPaymentDate: string }): ExtraPlan {
  const base = payoffWithExtra(i.balance, i.aprPct, i.monthly, 0);
  const faster = payoffWithExtra(i.balance, i.aprPct, i.monthly, i.extra);
  const finite = Number.isFinite(base.months) && Number.isFinite(faster.months);
  const dateFor = (m: number) => (Number.isFinite(m) && m > 0 ? addMonths(i.nextPaymentDate, m - 1) : i.nextPaymentDate);
  return {
    months: faster.months,
    baseMonths: base.months,
    monthsSaved: finite ? base.months - faster.months : 0,
    interest: faster.interest,
    interestSaved: finite ? base.interest - faster.interest : 0,
    paidOffDate: dateFor(faster.months),
    basePaidOffDate: dateFor(base.months),
  };
}

export interface ScheduledPayment { number: number; date: string; amount: Cents; principal: Cents; interest: Cents }

/** Last `count` scheduled payments, newest first, rebuilt by walking the amortization back from today's balance. */
export function recentScheduledPayments(i: { balance: Cents; aprPct: number; monthly: Cents; paymentsMade: number; nextPaymentDate: string; count: number }): ScheduledPayment[] {
  const r = i.aprPct / 100 / 12;
  const n = Math.max(0, Math.min(i.count, i.paymentsMade));
  const out: ScheduledPayment[] = [];
  let after = i.balance;
  for (let k = 0; k < n; k++) {
    const before = Math.round((after + i.monthly) / (1 + r));
    const interest = Math.min(i.monthly, monthlyInterest(before, i.aprPct));
    out.push({ number: i.paymentsMade - k, date: addMonths(i.nextPaymentDate, -(k + 1)), amount: i.monthly, principal: i.monthly - interest, interest });
    after = before;
  }
  return out;
}

export interface LeasePace { projectedMiles: number; overBy: number; underBy: number; pctOfAllowance: number }

const MONTHS_PER_YEAR = 12;

/** Projected odometer at lease end at today's estimated driving pace. */
export function leasePace(i: { odometer: number; annualMilesEst: number; monthsRemaining: number; allowance: number }): LeasePace {
  const projectedMiles = Math.round(i.odometer + (i.annualMilesEst * i.monthsRemaining) / MONTHS_PER_YEAR);
  return {
    projectedMiles,
    overBy: Math.max(0, projectedMiles - i.allowance),
    underBy: Math.max(0, i.allowance - projectedMiles),
    pctOfAllowance: i.allowance > 0 ? Math.round((i.odometer / i.allowance) * 100) : 0,
  };
}

/** Common lender guideline: housing payment at or under 28% of gross monthly income. */
export const HOUSING_RATIO = 0.28;

export interface Affordability { financed: Cents; monthly: Cents; limit: Cents; fits: boolean; totalInterest: Cents; totalPayments: Cents; ratioPct: number }

/** Principal & interest only (no taxes, insurance or PMI). */
export function affordability(i: { price: Cents; down: Cents; aprPct: number; termYears: number; incomeMonthly: Cents }): Affordability {
  const financed = Math.max(0, i.price - i.down);
  const months = i.termYears * MONTHS_PER_YEAR;
  const monthly = financed > 0 ? amortize(financed, i.aprPct, months) : 0;
  const limit = Math.round(i.incomeMonthly * HOUSING_RATIO);
  const totalPayments = monthly * months;
  return {
    financed, monthly, limit, fits: monthly <= limit,
    totalPayments, totalInterest: Math.max(0, totalPayments - financed),
    ratioPct: i.incomeMonthly > 0 ? Math.round((monthly / i.incomeMonthly) * 1000) / 10 : 0,
  };
}
