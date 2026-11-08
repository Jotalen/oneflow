import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { Analysis } from "@/lib/engine/analyze";
import { buildBankView, type LedgerTxn } from "@/lib/bank/view";
import {
  netWorthSeries, cashChange, debtPaidInMonth, safetyStatus, runwayDays, paymentToReachUtil, rankDebts, cappedPayment,
} from "@/lib/bank/wealth";

const load = (id: string) => { const a = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/snapshots", `${id}.json`), "utf8")) as Analysis; return { a, v: buildBankView(a) }; };

const txn = (over: Partial<LedgerTxn>): LedgerTxn => ({
  id: "t", accountId: "a", accountKind: "checking", accountLabel: "Checking", date: "2026-11-03",
  merchant: "Card payment", category: "transfer", amount: -5_000, status: "executed", kind: "transfer", ...over,
});

describe("netWorthSeries", () => {
  test("shifts cash history by the non-cash part so the last point equals net worth", () => {
    // Arrange
    const history = [{ date: "2026-11-06", value: 1_000 }, { date: "2026-11-07", value: 2_000 }];
    // Act
    const out = netWorthSeries(history, 10_000, 2_000);
    // Assert
    expect(out).toEqual([{ date: "2026-11-06", value: 9_000 }, { date: "2026-11-07", value: 10_000 }]);
  });
  test("real persona: last point equals view net worth", () => {
    const { v } = load("C001");
    const s = netWorthSeries(v.cashHistory, v.netWorth.value, v.cash);
    expect(s[s.length - 1].value).toBe(v.netWorth.value);
  });
});

describe("cashChange", () => {
  test("last minus first, 0 for empty", () => {
    expect(cashChange([{ date: "a", value: 100 }, { date: "b", value: 350 }])).toBe(250);
    expect(cashChange([])).toBe(0);
  });
});

describe("debtPaidInMonth", () => {
  test("sums card payment transfers in the month only", () => {
    const ledger = [txn({}), txn({ date: "2026-10-30" }), txn({ merchant: "Move to savings" }), txn({ merchant: "Card payment: Nova", amount: -2_500 })];
    expect(debtPaidInMonth(ledger, "2026-11")).toBe(7_500);
  });
  test("zero when there are none (snapshot personas)", () => {
    const { v } = load("C001");
    expect(debtPaidInMonth(v.ledger, "2026-11")).toBe(0);
  });
});

describe("safetyStatus", () => {
  test.each([[0.5, "Needs attention"], [2.9, "Building"], [3, "Okay · aim for 6"], [6, "Strong"], [8, "Strong"]])("%s months → %s", (m, label) => {
    expect(safetyStatus(m)).toBe(label);
  });
});

describe("runwayDays", () => {
  test("fund over daily essentials, floored", () => {
    expect(runwayDays(100_000, 300_000)).toBe(10);
    expect(runwayDays(0, 300_000)).toBe(0);
    expect(runwayDays(100, 0)).toBe(0);
  });
});

describe("paymentToReachUtil", () => {
  test("amount that brings the balance strictly under 10% of the limit", () => {
    expect(paymentToReachUtil(124_018, 500_000, 10)).toBe(74_019);
  });
  test("zero when already under or no limit", () => {
    expect(paymentToReachUtil(10_000, 500_000, 10)).toBe(0);
    expect(paymentToReachUtil(10_000, 0, 10)).toBe(0);
  });
});

describe("cappedPayment", () => {
  test("caps at what checking can cover", () => {
    expect(cappedPayment(50_000, 20_000)).toBe(20_000);
    expect(cappedPayment(50_000, 90_000)).toBe(50_000);
    expect(cappedPayment(50_000, -10)).toBe(0);
  });
});

describe("rankDebts", () => {
  test("orders by APR, lease gets no APR and no rank", () => {
    const { a } = load("C003");
    const rows = rankDebts(a.profile.debts);
    expect(rows[0].debt.kind).toBe("card");
    expect(rows[0].order).toBe(1);
    const lease = rows.find((r) => r.debt.kind === "auto_lease");
    expect(lease?.apr).toBeNull();
    expect(lease?.order).toBeNull();
  });
  test("loan persona ranks card first then loan", () => {
    const { a } = load("C001");
    expect(rankDebts(a.profile.debts).map((r) => r.order)).toEqual([1, 2]);
  });
});
