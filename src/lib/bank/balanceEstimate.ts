/**
 * Checking balance history for the Day-to-day chart, with clearly separated estimates.
 *
 * The bank only holds about 8 weeks (WINDOW_DAYS) of real transactions per customer. For longer
 * ranges the older days are ESTIMATED: starting from the oldest real balance, we walk backwards and
 * undo the customer's recurring money each day — paychecks (half of monthly income on two paydays),
 * recurring bills and the car payment on their due days, and a steady daily outflow for everyday
 * spending. The daily outflow is the larger of (a) what the real checking ledger shows and (b) what
 * is left of income after bills, so an estimated month never shows money piling up that the
 * customer did not actually have. Balances are floored at $0. Pure and deterministic.
 */
import { AS_OF, type Profile } from "@/lib/engine/types";
import { WINDOW_DAYS, addDays, isSettled, type LedgerTxn, type Point } from "@/lib/bank/view";
import type { Cents } from "@/lib/money";

export type BalanceRange = "1M" | "3M" | "6M";
export const RANGE_DAYS: Record<BalanceRange, number> = { "1M": 30, "3M": 91, "6M": 182 };
export const BALANCE_RANGES: BalanceRange[] = ["1M", "3M", "6M"];

const DAYS_PER_MONTH = 365 / 12;
const HALF_MONTH = 15;

export interface RecurringFlows {
  /** One paycheck, paid on each of `paydays` (day of month). */
  paycheck: Cents;
  paydays: number[];
  bills: { amount: Cents; dueDay: number }[];
  /** Everyday spending and money moved out, per day. */
  dailyOut: Cents;
}

/** A chart point: `real` from the ledger, `estimated` rebuilt from recurring flows. */
export interface BalancePoint { date: string; real?: Cents; estimated?: Cents }

export interface BalanceSeries { points: BalancePoint[]; /** Last estimated date (shared with the first real point), or null. */ estimatedUntil: string | null }

const lastDayOfMonth = (iso: string): number => {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/** Does a monthly event on `day` fall on `iso`? Days past month end land on the last day. */
export function occursOn(day: number, iso: string): boolean {
  return Math.min(day, lastDayOfMonth(iso)) === Number(iso.slice(8, 10));
}

/** Two paydays, 15 days apart, one of them `paydayDay`. */
export function paydaysFor(paydayDay: number): number[] {
  return paydayDay > HALF_MONTH ? [paydayDay - HALF_MONTH, paydayDay] : [paydayDay, paydayDay + HALF_MONTH];
}

const flowOn = (iso: string, f: RecurringFlows): Cents => {
  const pay = f.paydays.filter((d) => occursOn(d, iso)).length * f.paycheck;
  const bills = f.bills.filter((b) => occursOn(b.dueDay, iso)).reduce((s, b) => s + b.amount, 0);
  return pay - bills - f.dailyOut;
};

/** `days` estimated end-of-day balances before `anchor`, oldest first (anchor itself excluded). */
export function estimateBefore(anchor: Point, days: number, flows: RecurringFlows): Point[] {
  const out: Point[] = [];
  let value = anchor.value;
  let date = anchor.date;
  for (let i = 0; i < days; i++) {
    value = Math.max(0, value - flowOn(date, flows));
    date = addDays(date, -1);
    out.push({ date, value });
  }
  return out.reverse();
}

/** Recurring money in and out of checking, from the profile and the real ledger. */
export function recurringFlows(p: Profile, ledger: LedgerTxn[]): RecurringFlows {
  const paycheck = Math.round(p.incomeMonthly / 2);
  const paydays = paydaysFor(p.paydayDay);
  const bills = [
    ...p.bills.filter((b) => b.status === "recurring" && !b.isVehiclePayment).map((b) => ({ amount: b.amount, dueDay: b.dueDay ?? 1 })),
    ...(p.contract ? [{ amount: p.contract.monthlyPayment, dueDay: p.contract.dueDay }] : []),
  ];
  const realOut = ledger.filter((t) => t.accountKind === "checking" && t.amount < 0 && isSettled(t)).reduce((s, t) => s - t.amount, 0);
  const observedDaily = Math.ceil(realOut / WINDOW_DAYS);
  const billsMonthly = bills.reduce((s, b) => s + b.amount, 0);
  const leftoverDaily = Math.ceil((paycheck * paydays.length - billsMonthly) / DAYS_PER_MONTH);
  return { paycheck, paydays, bills, dailyOut: Math.max(observedDaily, leftoverDaily, 0) };
}

/** Real daily checking balance for the last `days`, walked back from today's balance. */
export function checkingHistory(p: Profile, ledger: LedgerTxn[], days: number): Point[] {
  const byDay = ledger
    .filter((t) => t.accountKind === "checking")
    .reduce<Record<string, Cents>>((acc, t) => ({ ...acc, [t.date]: (acc[t.date] ?? 0) + t.amount }), {});
  const today = p.accounts.filter((a) => a.kind === "checking").reduce((s, a) => s + a.balance, 0);
  const out: Point[] = [];
  let bal = today;
  for (let i = 0; i <= days; i++) {
    const date = addDays(AS_OF, -i);
    out.push({ date, value: bal });
    bal -= byDay[date] ?? 0;
  }
  return out.reverse();
}

/** Chart series for a range: real for the ledger window, estimated before it, sharing one boundary point. */
export function balanceSeries(p: Profile, ledger: LedgerTxn[], range: BalanceRange): BalanceSeries {
  const days = RANGE_DAYS[range];
  const realDays = Math.min(days, WINDOW_DAYS);
  const real = checkingHistory(p, ledger, realDays);
  const realPoints: BalancePoint[] = real.map((pt) => ({ date: pt.date, real: pt.value }));
  if (days <= WINDOW_DAYS) return { points: realPoints, estimatedUntil: null };
  const anchor = real[0];
  const estimated = estimateBefore(anchor, days - WINDOW_DAYS, recurringFlows(p, ledger));
  return {
    points: [
      ...estimated.map((pt) => ({ date: pt.date, estimated: pt.value })),
      { ...realPoints[0], estimated: anchor.value },
      ...realPoints.slice(1),
    ],
    estimatedUntil: anchor.date,
  };
}
