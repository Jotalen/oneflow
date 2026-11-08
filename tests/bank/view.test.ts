import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { Analysis } from "@/lib/engine/analyze";
import {
  categorize, buildLedger, cashHistory, rewardsFor, estimateCreditScore, loanStats, payoffWithExtra, monthsToTarget, buildBankView,
  CATEGORY_LABEL, REWARD_RATE, REWARD_RULES, budgetNote, isSpendingCategory, type SpendingCategory,
} from "@/lib/bank/view";

const snap = (id: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/snapshots", `${id}.json`), "utf8")) as Analysis;

describe("categorize", () => {
  test("maps seeded merchant names to categories", () => {
    expect(categorize("purchase", "Tom Thumb")).toBe("groceries");
    expect(categorize("purchase", "Torchy's Tacos")).toBe("food");
    expect(categorize("purchase", "QuikTrip")).toBe("gas");
    expect(categorize("deposit", "Paycheck")).toBe("income");
    expect(categorize("transfer", "Runway: automatic savings")).toBe("transfer");
    expect(categorize("purchase", "Unknown Shop")).toBe("misc");
  });
});

describe("buildLedger", () => {
  const a = snap("C003");
  const ledger = buildLedger(a.profile);
  test("every txn gets a date inside the 56-day window ending at AS_OF, newest first", () => {
    expect(ledger.length).toBe(a.profile.recentTxns.length);
    for (const t of ledger) { expect(t.date <= "2026-11-07").toBe(true); expect(t.date >= "2026-09-12").toBe(true); }
    const dates = ledger.map((t) => t.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });
  test("outflows are negative, deposits positive", () => {
    expect(ledger.find((t) => t.category === "income")!.amount).toBeGreaterThan(0);
    expect(ledger.find((t) => t.category === "groceries")!.amount).toBeLessThan(0);
  });
  test("a transfer reads as money in on the receiving account and money out on the paying one", () => {
    const profile = {
      ...a.profile,
      accounts: [{ id: "chk", kind: "checking" as const, nickname: "Checking", balance: 0, available: 0 }],
      recentTxns: [
        { id: "t_in", accountId: "chk", kind: "transfer", status: "completed", amount: 100, description: "P2P Brian → Priya", payeeId: "chk" },
        { id: "t_out", accountId: "chk", kind: "transfer", status: "completed", amount: 250, description: "P2P Priya → Linda", payeeId: "chk_linda" },
      ],
    };
    const byId = Object.fromEntries(buildLedger(profile).map((t) => [t.id, t.amount]));
    expect(byId).toEqual({ t_in: 100, t_out: -250 });
  });
});

describe("cashHistory", () => {
  test("ends at today's cash balance and has one point per day", () => {
    const a = snap("C003");
    const h = cashHistory(a.profile, buildLedger(a.profile), 30);
    expect(h.length).toBe(31);
    const cash = a.profile.accounts.filter((x) => x.kind === "checking" || x.kind === "savings").reduce((s, x) => s + x.balance, 0);
    expect(h[h.length - 1]).toEqual({ date: "2026-11-07", value: cash });
  });
});

describe("rewards", () => {
  test("3x dining (Food & Drink), 2x groceries/gas, 1x else, card purchases only; 100 pts = $1", () => {
    const r = rewardsFor([
      { id: "1", accountId: "card", accountKind: "card", accountLabel: "", date: "2026-11-01", merchant: "Torchy's Tacos", category: "food", amount: -1000, status: "completed", kind: "purchase" },
      { id: "2", accountId: "card", accountKind: "card", accountLabel: "", date: "2026-11-01", merchant: "QuikTrip", category: "gas", amount: -1000, status: "completed", kind: "purchase" },
      { id: "3", accountId: "card", accountKind: "card", accountLabel: "", date: "2026-11-01", merchant: "Target", category: "shopping", amount: -1000, status: "completed", kind: "purchase" },
      { id: "4", accountId: "chk", accountKind: "checking", accountLabel: "", date: "2026-11-01", merchant: "Target", category: "shopping", amount: -5000, status: "completed", kind: "purchase" },
    ]);
    expect(r.points).toBe(30 + 20 + 10);
    expect(r.valueCents).toBe(60);
  });
});

describe("estimateCreditScore", () => {
  test("tier A, low use, no misses scores Very good or better", () => {
    expect(estimateCreditScore({ tier: "A", utilizationPct: 5, missed12m: 0 }).score).toBeGreaterThanOrEqual(740);
  });
  test("missed payments and high use lower the score, clamped 300..850", () => {
    const s = estimateCreditScore({ tier: "D", utilizationPct: 95, missed12m: 3 });
    expect(s.score).toBeLessThan(600);
    expect(s.score).toBeGreaterThanOrEqual(300);
  });
});

describe("loanStats", () => {
  test("C001 RAV4 loan: payments made, principal vs interest split adds up", () => {
    const a = snap("C001");
    const s = loanStats(a.profile.contract!)!;
    expect(s.paymentsMade).toBe(29);
    expect(s.paymentsLeft).toBe(43);
    expect(s.totalPaid).toBe(29 * a.profile.contract!.monthlyPayment);
    expect(s.principalPaid + s.interestPaid).toBe(s.totalPaid);
    expect(s.interestPaid).toBeGreaterThan(0);
    expect(s.interestAhead).toBeGreaterThan(0);
  });
  test("extra $50/mo pays off sooner and saves interest", () => {
    const r = payoffWithExtra(2_292_095, 12.9, 66_851, 5_000);
    const base = payoffWithExtra(2_292_095, 12.9, 66_851, 0);
    expect(r.months).toBeLessThan(base.months);
    expect(r.interest).toBeLessThan(base.interest);
  });
});

describe("monthsToTarget", () => {
  test("months of saving needed, 0 if already there, Infinity if saving 0", () => {
    expect(monthsToTarget(100_000, 400_000, 30_000)).toBe(10);
    expect(monthsToTarget(500_000, 400_000, 30_000)).toBe(0);
    expect(monthsToTarget(0, 400_000, 0)).toBe(Infinity);
  });
});

describe("buildBankView", () => {
  test.each(["C001", "C003", "C014", "C018"])("%s builds finite totals and a consistent net worth", (id) => {
    const v = buildBankView(snap(id));
    expect(Number.isFinite(v.netWorth.value)).toBe(true);
    expect(v.netWorth.value).toBe(v.netWorth.own - v.netWorth.owe);
    expect(v.budget.categories.length).toBeGreaterThan(0);
    expect(v.safetyNet.essentialsMonthly).toBeGreaterThan(0);
  });
  test("lease persona does not count the leased car as owned", () => {
    const v = buildBankView(snap("C003"));
    expect(v.netWorth.ownParts.some((p) => p.key === "car")).toBe(false);
  });
});

describe("budget categories", () => {
  test.each(["C001", "C003", "C014", "C018"])("%s: every budget line is one of the 16 spending categories, labelled", (id) => {
    const v = buildBankView(snap(id));
    for (const c of v.budget.categories) {
      expect(isSpendingCategory(c.key)).toBe(true);
      expect(c.label).toBe(CATEGORY_LABEL[c.key as SpendingCategory]);
    }
    expect(v.budget.limit).toBe(v.budget.categories.reduce((s, c) => s + c.limit, 0));
  });
  test("car payment is a fixed Automotive line; subscriptions + other debt are a fixed Bills & Utilities line", () => {
    const a = snap("C001");
    const v = buildBankView(a);
    const auto = v.budget.categories.find((c) => c.key === "automotive")!;
    expect(auto).toMatchObject({ fixed: true, limit: a.profile.contract!.monthlyPayment, detail: "Car payment" });
    const recurring = a.profile.bills.filter((b) => b.status === "recurring" && (b.isSubscription || b.isDebtPayment));
    const bills = v.budget.categories.find((c) => c.key === "bills")!;
    expect(bills.fixed).toBe(true);
    expect(bills.limit).toBe(recurring.reduce((s, b) => s + b.amount, 0));
  });
  test("flexible lines come from the ledger's spending, never income or transfers", () => {
    const flex = buildBankView(snap("C001")).budget.categories.filter((c) => !c.fixed).map((c) => c.key);
    expect(flex).toContain("groceries");
    expect(flex).toContain("food");
    expect(flex).not.toContain("income");
    expect(flex).not.toContain("transfer");
  });
  test("safety-net essentials still use the car payment, subscriptions and debt bills directly", () => {
    const a = snap("C001");
    const v = buildBankView(a);
    const byLabel = Object.fromEntries(v.safetyNet.essentials.map((e) => [e.label, e.value]));
    expect(byLabel["Car payment"]).toBe(a.profile.contract!.monthlyPayment);
    const subs = a.profile.bills.filter((b) => b.status === "recurring" && b.isSubscription).reduce((s, b) => s + b.amount, 0);
    expect(byLabel["Phone & subscriptions"]).toBe(subs);
    expect(byLabel["Groceries"]).toBe(v.budget.categories.find((c) => c.key === "groceries")!.limit);
  });
  test("budgetNote: bills read Paid / Due, flexible lines read left / over", () => {
    expect(budgetNote({ fixed: true, spent: 100, limit: 100 })).toBe("Paid");
    expect(budgetNote({ fixed: true, spent: 0, limit: 100 })).toBe("Due this month");
    expect(budgetNote({ fixed: false, spent: 2_500, limit: 10_000 })).toBe("$75.00 left");
    expect(budgetNote({ fixed: false, spent: 12_000, limit: 10_000 })).toBe("Over by $20.00");
  });
});

describe("REWARD_RULES", () => {
  test("matches REWARD_RATE: 3x dining, 2x groceries and gas, 1x everything else", () => {
    expect(REWARD_RULES.map((r) => r.rate)).toEqual([3, 2, 1]);
    expect(REWARD_RATE).toEqual({ food: 3, groceries: 2, gas: 2 });
  });
});
