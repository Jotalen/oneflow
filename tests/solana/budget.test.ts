import { describe, expect, test } from "vitest";
import type { Budget } from "@/lib/bank/view";
import { previewPaymentBudget } from "@/lib/solana/budget";

const budget: Budget = {
  month: "2026-11", dayOfMonth: 8, daysInMonth: 30, limit: 100_000, spent: 70_000,
  categories: [
    { key: "shopping", label: "Shopping", limit: 10_000, spent: 9_500, fixed: false, note: "" },
    { key: "bills", label: "Bills", limit: 90_000, spent: 60_500, fixed: true, note: "" },
  ],
};

describe("demo budget payment preview", () => {
  test("shows remaining category and monthly room without changing the bank budget", () => {
    expect(previewPaymentBudget(budget, "shopping", BigInt(1_000_000))).toMatchObject({ cents: 100, before: 500, after: 400, overBy: 0, totalAfter: 29_900 });
    expect(budget.categories[0].spent).toBe(9_500);
  });
  test("shows the actual overage when the hypothetical spend exceeds a category", () => {
    expect(previewPaymentBudget(budget, "shopping", BigInt(6_000_000))).toMatchObject({ after: -100, overBy: 100 });
  });
  test("rounds sub-cent token amounts up rather than hiding their budget effect", () => {
    expect(previewPaymentBudget(budget, "shopping", BigInt(1))?.cents).toBe(1);
    expect(previewPaymentBudget(budget, "shopping", BigInt(10_001))?.cents).toBe(2);
  });
  test("does not compare a payment against a fixed bill or nonexistent category", () => {
    expect(previewPaymentBudget(budget, "bills", BigInt(1))).toBeNull();
    expect(previewPaymentBudget(budget, "missing", BigInt(1))).toBeNull();
  });
  test("rejects nonpositive amounts and unsafe conversions", () => {
    expect(() => previewPaymentBudget(budget, "shopping", BigInt(0))).toThrow();
    expect(() => previewPaymentBudget(budget, "shopping", BigInt("9999999999999999999999999"))).toThrow();
  });
});
