import { describe, expect, test } from "vitest";
import type { Budget, LedgerTxn } from "@/lib/bank/view";
import {
  EMPTY_PLAN, MAX_CATEGORY_LIMIT, effectiveOverrides, parsePlan, planBudget, resolvePlan, seedManual, switchMode, wheelSlices,
} from "@/lib/bank/budgetPlan";

const tx = (o: Partial<LedgerTxn>): LedgerTxn => ({
  id: "t", accountId: "a", accountKind: "checking", accountLabel: "Checking", date: "2026-11-05",
  merchant: "X", category: "groceries", amount: -1_000, status: "completed", kind: "purchase", ...o,
});

const suggested: Budget = {
  month: "2026-11", dayOfMonth: 7, daysInMonth: 30, spent: 80_000, limit: 140_000,
  categories: [
    { key: "automotive", label: "Automotive", spent: 60_000, limit: 60_000, note: "Paid", fixed: true, detail: "Car payment" },
    { key: "food", label: "Food & Drink", spent: 5_000, limit: 30_000, note: "", fixed: false },
    { key: "groceries", label: "Groceries", spent: 15_000, limit: 50_000, note: "", fixed: false },
  ],
};

const ledger: LedgerTxn[] = [
  tx({ id: "g", category: "groceries", amount: -15_000 }),
  tx({ id: "f", category: "food", amount: -5_000 }),
  tx({ id: "p", category: "personal", amount: -2_500 }),
  tx({ id: "old", category: "personal", amount: -9_999, date: "2026-10-30" }),
  tx({ id: "in", category: "income", amount: 100_000, kind: "deposit" }),
];

describe("parsePlan", () => {
  test("missing or corrupt storage is null (caller falls back)", () => {
    expect(parsePlan(null)).toBeNull();
    expect(parsePlan("{not json")).toBeNull();
    expect(parsePlan(JSON.stringify({ mode: "sideways" }))).toBeNull();
  });
  test("keeps valid whole-cent amounts and drops invalid ones", () => {
    const p = parsePlan(JSON.stringify({ mode: "manual", auto: { food: 1_000 }, manual: { food: 2_000, gas: -5, home: 1.5, travel: MAX_CATEGORY_LIMIT + 1 } }));
    expect(p).toEqual({ mode: "manual", auto: { food: 1_000 }, manual: { food: 2_000 } });
  });
});

describe("resolvePlan", () => {
  test("a stored plan wins", () => {
    const stored = { mode: "manual" as const, auto: {}, manual: { food: 1 } };
    expect(resolvePlan(stored, { food: 9 })).toBe(stored);
  });
  test("without a plan, older 'Edit budget' overrides become auto-mode tweaks", () => {
    expect(resolvePlan(null, { food: 9 })).toEqual({ ...EMPTY_PLAN, auto: { food: 9 } });
  });
});

describe("planBudget — Set it for me", () => {
  test("uses the suggested limits, with the user's tweaks", () => {
    const b = planBudget(suggested, ledger, { mode: "auto", auto: { food: 10_000 }, manual: {} });
    expect(b.categories.map((c) => [c.key, c.limit])).toEqual([["automotive", 60_000], ["food", 10_000], ["groceries", 50_000]]);
    expect(b.limit).toBe(120_000);
  });
  test("does not mutate the suggested budget", () => {
    planBudget(suggested, ledger, { mode: "auto", auto: { food: 1 }, manual: {} });
    expect(suggested.categories[1].limit).toBe(30_000);
  });
});

describe("planBudget — Set my own", () => {
  const plan = { mode: "manual" as const, auto: {}, manual: { groceries: 40_000, travel: 20_000 } };
  const b = planBudget(suggested, ledger, plan);
  const byKey = Object.fromEntries(b.categories.map((c) => [c.key, c]));
  test("uses the user's amounts per category", () => {
    expect(byKey.groceries.limit).toBe(40_000);
    expect(byKey.travel).toMatchObject({ limit: 20_000, spent: 0, label: "Travel" });
  });
  test("bills stay fixed at their real amount", () => {
    expect(byKey.automotive).toMatchObject({ limit: 60_000, fixed: true });
  });
  test("a category with spending this month but no amount set shows as over budget", () => {
    expect(byKey.food).toMatchObject({ limit: 0, spent: 5_000, note: "Over by $50.00" });
    expect(byKey.personal).toMatchObject({ limit: 0, spent: 2_500 });
  });
  test("categories with no amount and no spending are left out; totals add up", () => {
    expect(byKey.gas).toBeUndefined();
    expect(b.limit).toBe(60_000 + 40_000 + 20_000);
    expect(b.spent).toBe(60_000 + 15_000 + 5_000 + 2_500);
  });
  test("ordered like the category list", () => {
    expect(b.categories.map((c) => c.key)).toEqual(["automotive", "food", "groceries", "personal", "travel"]);
  });
});

describe("seedManual / switchMode", () => {
  test("seedManual copies the flexible suggested limits only", () => {
    expect(seedManual(suggested)).toEqual({ food: 30_000, groceries: 50_000 });
  });
  test("switching to manual the first time starts from the suggestion; later switches keep the user's amounts", () => {
    const first = switchMode(EMPTY_PLAN, "manual", suggested);
    expect(first).toEqual({ mode: "manual", auto: {}, manual: { food: 30_000, groceries: 50_000 } });
    const edited = { ...first, manual: { food: 1 } };
    expect(switchMode(switchMode(edited, "auto", suggested), "manual", suggested).manual).toEqual({ food: 1 });
  });
});

describe("effectiveOverrides", () => {
  test("auto mode passes the tweaks through", () => {
    expect(effectiveOverrides({ mode: "auto", auto: { food: 5 }, manual: { food: 9 } }, suggested, ledger)).toEqual({ food: 5 });
  });
  test("manual mode gives every flexible line its manual limit (0 when unset)", () => {
    expect(effectiveOverrides({ mode: "manual", auto: {}, manual: { groceries: 7 } }, suggested, ledger)).toEqual({ food: 0, groceries: 7, personal: 0 });
  });
});

describe("wheelSlices", () => {
  const b: Budget = {
    ...suggested,
    categories: [
      { key: "food", label: "Food & Drink", spent: 0, limit: 10_000, note: "", fixed: false },
      { key: "gas", label: "Gas", spent: 2_500, limit: 10_000, note: "", fixed: false },
      { key: "home", label: "Home", spent: 10_000, limit: 10_000, note: "", fixed: false },
      { key: "travel", label: "Travel", spent: 15_000, limit: 10_000, note: "", fixed: false },
      { key: "personal", label: "Personal", spent: 500, limit: 0, note: "", fixed: false },
      { key: "misc", label: "Miscellaneous", spent: 0, limit: 0, note: "", fixed: false },
    ],
  };
  const s = wheelSlices(b);
  test("fill is the share of budget used, 0 (untouched) to 1 (all used), capped at 1", () => {
    expect(s.map((x) => x.fill)).toEqual([0, 0.25, 1, 1, 1, 0]);
  });
  test("over budget only when spending is above the limit", () => {
    expect(s.map((x) => x.over)).toEqual([false, false, false, true, true, false]);
    expect(s[3].overBy).toBe(5_000);
    expect(s[3].pct).toBe(150);
  });
});
