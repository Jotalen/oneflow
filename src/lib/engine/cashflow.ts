import type { Cents } from "@/lib/money";
import type { Profile } from "./types";

/** Shared cash-flow heuristics (all synthetic; constants documented in README). */
export const TAKE_HOME_RATIO = 0.75;
export const OBSERVED_WINDOW_MONTHS = 2; // seeded purchases span ~2 months
export const DEFAULT_DISCRETIONARY_RATIO = 0.15;
export const ESSENTIAL_DISCRETIONARY_SHARE = 0.5;

export const takeHome = (p: Profile): Cents => Math.round((p.incomeMonthly ?? 0) * TAKE_HOME_RATIO);

export const liquidTotal = (p: Profile): Cents =>
  p.accounts.filter((a) => a.kind !== "card").reduce((s, a) => s + Math.max(0, a.available), 0);

export const recurringBills = (p: Profile): Cents =>
  p.bills.filter((b) => b.status === "recurring" && !b.isVehiclePayment).reduce((s, b) => s + b.amount, 0);

export const debtPayments = (p: Profile): Cents => p.debts.reduce((s, d) => s + d.monthlyPayment, 0);

export function discretionaryMonthly(p: Profile): Cents {
  const purchases = p.recentTxns.filter((t) => t.kind === "purchase" && t.status !== "declined" && t.status !== "cancelled");
  if (purchases.length === 0) return Math.round(takeHome(p) * DEFAULT_DISCRETIONARY_RATIO);
  return Math.round(purchases.reduce((s, t) => s + t.amount, 0) / OBSERVED_WINDOW_MONTHS);
}

export const essentialMonthly = (p: Profile): Cents =>
  recurringBills(p) + debtPayments(p) + Math.round(discretionaryMonthly(p) * ESSENTIAL_DISCRETIONARY_SHARE);
