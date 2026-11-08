/**
 * Pure helpers for the Wealth and Borrowing pages (net worth, goals, safety net, debt, credit).
 * Deterministic calcs on BankView/Profile data only; nothing here invents history.
 */
import type { Debt } from "@/lib/engine/types";
import type { Cents } from "@/lib/money";
import type { LedgerTxn, Point } from "./view";

const DAYS_PER_MONTH = 30;
const CARD_PAYMENT_RE = /card payment|pay card/i;

/** Net worth over the window we have: cash history shifted by the (constant) non-cash part. */
export function netWorthSeries(history: Point[], netWorth: Cents, cash: Cents): Point[] {
  const offset = netWorth - cash;
  return history.map((p) => ({ date: p.date, value: p.value + offset }));
}

export function cashChange(history: Point[]): Cents {
  if (history.length === 0) return 0;
  return history[history.length - 1].value - history[0].value;
}

/** Card payments (transfers labeled as card payments) dated in `month` ("YYYY-MM"). */
export function debtPaidInMonth(ledger: LedgerTxn[], month: string): Cents {
  return ledger
    .filter((t) => t.date.startsWith(month) && t.category === "transfer" && t.amount < 0 && CARD_PAYMENT_RE.test(t.merchant))
    .reduce((s, t) => s - t.amount, 0);
}

export type SafetyLabel = "Needs attention" | "Building" | "Okay · aim for 6" | "Strong";

export function safetyStatus(months: number): SafetyLabel {
  if (months < 1) return "Needs attention";
  if (months < 3) return "Building";
  if (months < 6) return "Okay · aim for 6";
  return "Strong";
}

/** Days the fund covers essentials if income stopped. */
export function runwayDays(fund: Cents, essentialsMonthly: Cents): number {
  if (essentialsMonthly <= 0 || fund <= 0) return 0;
  return Math.floor((fund / essentialsMonthly) * DAYS_PER_MONTH);
}

/** Payment that brings card balance strictly under `targetPct` of the limit. */
export function paymentToReachUtil(balance: Cents, limit: Cents, targetPct: number): Cents {
  if (limit <= 0) return 0;
  const maxBalance = Math.ceil((limit * targetPct) / 100) - 1;
  return Math.max(0, balance - maxBalance);
}

/** Never more than checking can cover. */
export function cappedPayment(amount: Cents, available: Cents): Cents {
  return Math.max(0, Math.min(amount, available));
}

export interface RankedDebt { debt: Debt; apr: number | null; order: number | null }

/** Debts by highest APR first. Leases have no APR and no pay order. */
export function rankDebts(debts: Debt[]): RankedDebt[] {
  const payable = debts.filter((d) => d.kind !== "auto_lease" && d.balance > 0).sort((a, b) => b.aprPct - a.aprPct);
  const leases = debts.filter((d) => d.kind === "auto_lease");
  return [
    ...payable.map((debt, i) => ({ debt, apr: debt.aprPct, order: i + 1 })),
    ...leases.map((debt) => ({ debt, apr: null, order: null })),
  ];
}
