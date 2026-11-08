/**
 * Borrowing math for the car and house pages. Pure, deterministic, integer cents.
 * Rates come from the Toyota Financial Services hackathon rate sheet (RateRow).
 */
import { amortize } from "@/lib/engine/amortize";
import type { RateRow, ToyotaVehicle } from "@/lib/toyota/types";
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

/** Amount to finance: price − down − trade-in equity. Positive equity lowers it; negative equity (owed more than the car is worth) raises it. */
export function amountToFinance(i: { price: Cents; down: Cents; tradeEquity: Cents | null; useTrade: boolean }): Cents {
  const equity = i.useTrade && i.tradeEquity !== null ? i.tradeEquity : 0;
  return Math.max(0, i.price - i.down - equity);
}

export interface CatalogCar { id: string; label: string; model: string; trim: string; year: number; price: Cents }

const carId = (v: ToyotaVehicle) => `${v.model_year}-${v.model}-${v.trim}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");

/** New Toyotas from the TFS data pack (vehicles.csv), one per model + trim (newest year), by model then price. */
export function carCatalog(vehicles: ToyotaVehicle[]): CatalogCar[] {
  const newest = new Map<string, ToyotaVehicle>();
  for (const v of vehicles.filter((x) => x.condition_at_purchase === "New")) {
    const key = `${v.model}|${v.trim}`;
    const seen = newest.get(key);
    if (!seen || v.model_year > seen.model_year) newest.set(key, v);
  }
  return [...newest.values()]
    .map((v) => ({ id: carId(v), label: `${v.model_year} Toyota ${v.model} ${v.trim}`, model: v.model, trim: v.trim, year: v.model_year, price: v.purchase_price_or_msrp }))
    .sort((a, b) => a.model.localeCompare(b.model) || a.price - b.price);
}

export type PayoffStrategy = "avalanche" | "snowball" | "minimums";
export interface PayoffDebt { id: string; label: string; balance: Cents; aprPct: number; minPayment: Cents }
export interface PayoffRun { months: number | null; interest: Cents | null; order: string[] }
export interface StrategyResult extends PayoffRun { strategy: PayoffStrategy; interestSaved: Cents | null; monthsSooner: number | null }

const MAX_PAYOFF_MONTHS = 600;

/** Avalanche: highest APR first. Snowball: smallest balance first. */
function targetOrder(debts: PayoffDebt[], strategy: PayoffStrategy): PayoffDebt[] {
  return [...debts].sort((a, b) => (strategy === "snowball" ? a.balance - b.balance || b.aprPct - a.aprPct : b.aprPct - a.aprPct || a.balance - b.balance));
}

/** One month: interest accrues, every open debt gets its minimum, and `pool` goes to open debts in order. */
function payMonth(debts: PayoffDebt[], balances: Cents[], pool: Cents): { balances: Cents[]; interest: Cents } {
  const accrued = debts.map((d, k) => (balances[k] > 0 ? Math.round((balances[k] * d.aprPct) / 100 / MONTHS_PER_YEAR) : 0));
  const owed = balances.map((b, k) => b + accrued[k]);
  const afterMin = owed.map((b, k) => b - Math.min(b, debts[k].minPayment));
  const minPaid = owed.reduce((s, b, k) => s + (b - afterMin[k]), 0);
  let left = pool - minPaid;
  const next = afterMin.map((b) => { const pay = Math.max(0, Math.min(b, left)); left -= pay; return b - pay; });
  return { balances: next, interest: accrued.reduce((s, i) => s + i, 0) };
}

/**
 * Month-by-month payoff. Minimums: each debt at its own minimum. Avalanche/snowball: the same total
 * budget (all minimums + extra) every month; what's left after minimums goes to the first open debt
 * in order, so paid-off minimums roll over. Null when it never finishes in 50 years.
 */
export function simulatePayoff(debts: PayoffDebt[], extra: Cents, strategy: PayoffStrategy): PayoffRun {
  const ordered = targetOrder(debts, strategy);
  // Minimums-only gets no pool, so a paid-off debt's minimum is not reused.
  const pool = strategy === "minimums" ? 0 : ordered.reduce((s, d) => s + d.minPayment, 0) + extra;
  let balances = ordered.map((d) => d.balance);
  let interest = 0;
  let months = 0;
  while (balances.some((b) => b > 0) && months < MAX_PAYOFF_MONTHS) {
    const step = payMonth(ordered, balances, pool);
    balances = step.balances;
    interest += step.interest;
    months++;
  }
  const order = ordered.map((d) => d.id);
  return balances.some((b) => b > 0) ? { months: null, interest: null, order } : { months, interest, order };
}

/** Avalanche, snowball and minimums-only. Savings and months sooner are vs minimums only, null when minimums never finish. */
export function compareStrategies(debts: PayoffDebt[], extra: Cents): StrategyResult[] {
  const payable = debts.filter((d) => d.balance > 0);
  if (payable.length === 0) return [];
  const min = simulatePayoff(payable, 0, "minimums");
  const vsMin = (r: PayoffRun) => ({
    interestSaved: min.interest !== null && r.interest !== null ? min.interest - r.interest : null,
    monthsSooner: min.months !== null && r.months !== null ? min.months - r.months : null,
  });
  return (["avalanche", "snowball", "minimums"] as const).map((strategy) => {
    const r = strategy === "minimums" ? min : simulatePayoff(payable, extra, strategy);
    return { strategy, ...r, ...vsMin(r) };
  });
}
