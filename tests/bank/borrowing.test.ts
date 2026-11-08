import { describe, expect, test } from "vitest";
import { affordability, extraPaymentPlan, financeOptions, leasePace } from "@/lib/bank/borrowing";
import { amortize } from "@/lib/engine/amortize";
import type { RateRow } from "@/lib/toyota/types";

const RATES: RateRow[] = [
  { credit_tier: "A", tier_label: "Super Prime (720+)", term_months: 36, new_purchase_apr: 5.1, refinance_apr: 5.6 },
  { credit_tier: "A", tier_label: "Super Prime (720+)", term_months: 60, new_purchase_apr: 5.6, refinance_apr: 6.1 },
  { credit_tier: "A", tier_label: "Super Prime (720+)", term_months: 72, new_purchase_apr: 6.0, refinance_apr: 6.5 },
  { credit_tier: "B", tier_label: "Prime (660-719)", term_months: 36, new_purchase_apr: 6.9, refinance_apr: 7.4 },
];

describe("financeOptions", () => {
  test("uses only the customer's tier, sorted by total cost", () => {
    const rows = financeOptions({ amount: 2_000_000, rates: RATES, tier: "A", kind: "new", targetMonthly: 50_000 });
    expect(rows.map((r) => r.term)).toEqual([36, 60, 72]);
    expect(rows[0].monthly).toBe(amortize(2_000_000, 5.1, 36));
    expect(rows[0].totalPayments).toBe(rows[0].monthly * 36);
    expect(rows[0].totalInterest).toBe(rows[0].totalPayments - 2_000_000);
    for (let i = 1; i < rows.length; i++) expect(rows[i].totalPayments).toBeGreaterThanOrEqual(rows[i - 1].totalPayments);
  });
  test("best fit is the cheapest total cost row under the target payment", () => {
    const rows = financeOptions({ amount: 2_000_000, rates: RATES, tier: "A", kind: "new", targetMonthly: 40_000 });
    const fit = rows.filter((r) => r.bestFit);
    expect(fit).toHaveLength(1);
    expect(fit[0].monthly).toBeLessThanOrEqual(40_000);
    expect(fit[0].term).toBe(60);
  });
  test("refinance uses refinance_apr; no best fit when nothing fits", () => {
    const rows = financeOptions({ amount: 2_000_000, rates: RATES, tier: "A", kind: "refi", targetMonthly: 100 });
    expect(rows[0].apr).toBe(5.6);
    expect(rows.some((r) => r.bestFit)).toBe(false);
  });
  test("empty for zero amount or unknown tier", () => {
    expect(financeOptions({ amount: 0, rates: RATES, tier: "A", kind: "new", targetMonthly: 1 })).toEqual([]);
    expect(financeOptions({ amount: 1000, rates: RATES, tier: "Z", kind: "new", targetMonthly: 1 })).toEqual([]);
  });
});

describe("extraPaymentPlan", () => {
  test("extra payments save months and interest", () => {
    const r = extraPaymentPlan({ balance: 1_874_858, aprPct: 6.29, monthly: 46_879, extra: 5_000, nextPaymentDate: "2026-11-15" });
    expect(r.monthsSaved).toBeGreaterThan(0);
    expect(r.interestSaved).toBeGreaterThan(0);
    expect(r.paidOffDate < r.basePaidOffDate).toBe(true);
  });
  test("zero extra saves nothing", () => {
    const r = extraPaymentPlan({ balance: 1_000_000, aprPct: 5, monthly: 30_000, extra: 0, nextPaymentDate: "2026-12-01" });
    expect(r.monthsSaved).toBe(0);
    expect(r.interestSaved).toBe(0);
  });
});

describe("leasePace", () => {
  test("projects miles at lease end against the allowance", () => {
    const r = leasePace({ odometer: 30_000, annualMilesEst: 12_000, monthsRemaining: 6, allowance: 36_000 });
    expect(r.projectedMiles).toBe(36_000);
    expect(r.overBy).toBe(0);
    const over = leasePace({ odometer: 35_000, annualMilesEst: 12_000, monthsRemaining: 6, allowance: 36_000 });
    expect(over.overBy).toBe(5_000);
  });
});

describe("affordability", () => {
  test("monthly P&I and the 28% housing check", () => {
    const r = affordability({ price: 30_000_000, down: 6_000_000, aprPct: 6.5, termYears: 30, incomeMonthly: 800_000 });
    expect(r.financed).toBe(24_000_000);
    expect(r.monthly).toBe(amortize(24_000_000, 6.5, 360));
    expect(r.limit).toBe(224_000);
    expect(r.fits).toBe(r.monthly <= 224_000);
    expect(r.totalInterest).toBe(r.monthly * 360 - 24_000_000);
  });
  test("down payment over price finances nothing", () => {
    expect(affordability({ price: 100, down: 500, aprPct: 6.5, termYears: 30, incomeMonthly: 1 }).financed).toBe(0);
  });
});
