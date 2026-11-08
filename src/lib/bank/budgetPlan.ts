/**
 * Budget plan: "Set it for me" (suggested limits from spending, with optional tweaks) or
 * "Set my own" (the user's amount per category). Both are kept so switching never loses edits.
 * Bills (car payment, subscriptions, debt) stay fixed at their real amounts in both modes.
 * Pure: storage lives in the components (useBudgetPlan).
 */
import { z } from "zod";
import { CATEGORY_LABEL, SPENDING_CATEGORIES, budgetNote, isSpendingCategory, type BankView, type Budget, type BudgetCategory, type LedgerTxn } from "@/lib/bank/view";
import type { BudgetOverrides } from "@/lib/bank/everyday";
import type { Cents } from "@/lib/money";

export type BudgetMode = "auto" | "manual";
export interface BudgetPlan { mode: BudgetMode; auto: BudgetOverrides; manual: BudgetOverrides }

export const EMPTY_PLAN: BudgetPlan = { mode: "auto", auto: {}, manual: {} };
/** $100,000 a month per category is the most we accept. */
export const MAX_CATEGORY_LIMIT: Cents = 10_000_000;

const isValidLimit = (v: unknown): v is Cents => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_CATEGORY_LIMIT;

const validAmounts = (rec: Record<string, unknown>): BudgetOverrides =>
  Object.fromEntries(Object.entries(rec).filter(([k, v]) => isSpendingCategory(k) && isValidLimit(v))) as BudgetOverrides;

const Amounts = z.record(z.string(), z.unknown()).catch({}).transform(validAmounts);

/** Category keys renamed when the 16 categories arrived; an amount already saved under the new key wins. */
const RENAMED_KEYS: Readonly<Record<string, string>> = { dining: "food" };

function migrateLegacy(legacy: Record<string, unknown>): BudgetOverrides {
  const renamed = Object.fromEntries(Object.entries(legacy).filter(([k]) => k in RENAMED_KEYS).map(([k, v]) => [RENAMED_KEYS[k], v]));
  return validAmounts({ ...renamed, ...legacy });
}

const PlanSchema = z.object({ mode: z.enum(["auto", "manual"]), auto: Amounts.default({}), manual: Amounts.default({}) });

/** Stored JSON → plan; null when missing or unreadable so the caller can fall back. */
export function parsePlan(raw: string | null): BudgetPlan | null {
  if (raw === null) return null;
  try {
    const parsed = PlanSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** A stored plan, or the older "Edit budget" overrides carried over as auto-mode tweaks. */
export function resolvePlan(stored: BudgetPlan | null, legacy: BudgetOverrides): BudgetPlan {
  return stored ?? { ...EMPTY_PLAN, auto: migrateLegacy(legacy) };
}

const totals = (budget: Budget, categories: BudgetCategory[]): Budget => ({
  ...budget,
  categories,
  spent: categories.reduce((s, c) => s + c.spent, 0),
  limit: categories.reduce((s, c) => s + c.limit, 0),
});

const withLimit = (c: BudgetCategory, limit: Cents): BudgetCategory => {
  const next = { ...c, limit };
  return { ...next, note: budgetNote(next) };
};

function spentThisMonth(ledger: LedgerTxn[], month: string, key: string): Cents {
  return ledger.filter((t) => t.date.startsWith(month) && t.amount < 0 && t.category === key).reduce((s, t) => s - t.amount, 0);
}

function manualLines(suggested: Budget, ledger: LedgerTxn[], manual: BudgetOverrides): BudgetCategory[] {
  return SPENDING_CATEGORIES.flatMap((key): BudgetCategory[] => {
    const s = suggested.categories.find((c) => c.key === key);
    if (s?.fixed) return [s];
    const limit = manual[key] ?? 0;
    const spent = s ? s.spent : spentThisMonth(ledger, suggested.month, key);
    if (limit === 0 && spent === 0) return [];
    return [withLimit({ key, label: CATEGORY_LABEL[key], spent, limit, note: "", fixed: false }, limit)];
  });
}

/** The budget the user sees for their plan. Never mutates `suggested`. */
export function planBudget(suggested: Budget, ledger: LedgerTxn[], plan: BudgetPlan): Budget {
  if (plan.mode === "manual") return totals(suggested, manualLines(suggested, ledger, plan.manual));
  const categories = suggested.categories.map((c) => {
    const o = plan.auto[c.key];
    return !c.fixed && isValidLimit(o) ? withLimit(c, o) : c;
  });
  return totals(suggested, categories);
}

/** The bank view with its budget replaced by the user's plan, so every screen shows the same limits. */
export function viewWithPlan(view: BankView, plan: BudgetPlan): BankView {
  return { ...view, budget: planBudget(view.budget, view.ledger, plan) };
}

/** Starting amounts for "Set my own": the flexible suggested limits. */
export function seedManual(suggested: Budget): BudgetOverrides {
  return Object.fromEntries(suggested.categories.filter((c) => !c.fixed).map((c) => [c.key, c.limit]));
}

/** Change mode; the first switch to "Set my own" starts from the suggestion. */
export function switchMode(plan: BudgetPlan, mode: BudgetMode, suggested: Budget): BudgetPlan {
  const needsSeed = mode === "manual" && Object.keys(plan.manual).length === 0;
  return { ...plan, mode, manual: needsSeed ? seedManual(suggested) : plan.manual };
}

/** Per-category limits as plain overrides, for screens that only read the older overrides key. */
export function effectiveOverrides(plan: BudgetPlan, suggested: Budget, ledger: LedgerTxn[]): BudgetOverrides {
  if (plan.mode === "auto") return plan.auto;
  return Object.fromEntries(planBudget(suggested, ledger, plan).categories.filter((c) => !c.fixed).map((c) => [c.key, c.limit]));
}

/** One pizza-wheel slice: `fill` 0 (untouched) → 1 (budget used up); `over` when spending passed the limit. */
export interface WheelSlice { key: string; label: string; spent: Cents; limit: Cents; fill: number; over: boolean; overBy: Cents; pct: number; fixed: boolean }

export function wheelSlices(budget: Budget): WheelSlice[] {
  return budget.categories.map((c) => {
    const fill = c.limit > 0 ? Math.min(1, c.spent / c.limit) : c.spent > 0 ? 1 : 0;
    const pct = c.limit > 0 ? Math.round((c.spent / c.limit) * 100) : c.spent > 0 ? 100 : 0;
    const overBy = Math.max(0, c.spent - c.limit);
    return { key: c.key, label: c.label, spent: c.spent, limit: c.limit, fill, over: overBy > 0, overBy, pct, fixed: c.fixed };
  });
}
