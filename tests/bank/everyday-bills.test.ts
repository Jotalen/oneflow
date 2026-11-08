import { describe, expect, test } from "vitest";
import type { LedgerTxn, UpcomingBill } from "@/lib/bank/view";
import { billOptions, categoryOf, defaultBillId, pointsSummary } from "@/lib/bank/everyday";

const bill = (o: Partial<UpcomingBill>): UpcomingBill => ({ id: "b", label: "Netflix", detail: "Autopay on", amount: 1_599, date: "2026-11-09", ...o });
const card = bill({ id: "card", label: "Rewards Card", detail: "Minimum due · balance $500.00", amount: 2_500, date: "2026-11-21" });
const car = bill({ id: "car", label: "Car payment · Toyota", detail: "Payment 30 of 72 · autopay on", amount: 66_851, date: "2026-12-01" });

describe("billOptions", () => {
  test("every real upcoming bill is listed; only the card can be paid here (via /api/transfer)", () => {
    const out = billOptions([bill({}), card, car], 50_000);
    expect(out.map((o) => [o.id, o.payable])).toEqual([["b", false], ["card", true], ["car", false]]);
    expect(out[0].reason).toBe("On autopay");
  });
  test("the card is not payable with a zero balance", () => {
    expect(billOptions([card], 0)[0].payable).toBe(false);
  });
  test("a bill without autopay explains it is paid outside OneFlow", () => {
    expect(billOptions([bill({ detail: "Monthly" })], 0)[0].reason).toBe("Pay this one with the biller");
  });
});

describe("defaultBillId", () => {
  test("preselects when exactly one bill can be paid", () => {
    expect(defaultBillId(billOptions([bill({}), card], 10_000))).toBe("card");
  });
  test("no preselection when none can be paid", () => {
    expect(defaultBillId(billOptions([bill({})], 10_000))).toBe("");
    expect(defaultBillId([])).toBe("");
  });
  test("no preselection when several can be paid", () => {
    const two = [{ ...billOptions([card], 1)[0] }, { ...billOptions([card], 1)[0], id: "card2" }];
    expect(defaultBillId(two)).toBe("");
  });
});

const tx = (o: Partial<LedgerTxn>): LedgerTxn => ({
  id: "t1", accountId: "c", accountKind: "card", accountLabel: "Card", date: "2026-11-06",
  merchant: "Starbucks", category: "food", amount: -1_000, status: "completed", kind: "purchase", ...o,
});

describe("categoryOf", () => {
  test("ignores a stored category from the old category set", () => {
    expect(categoryOf(tx({}), { t1: { category: "dining" as never } })).toBe("food");
    expect(categoryOf(tx({}), { t1: { category: "travel" } })).toBe("travel");
  });
});

describe("pointsSummary", () => {
  test("totals points over card purchases only, using the user's category", () => {
    const rows = [
      tx({ id: "a", category: "food", amount: -1_000 }),
      tx({ id: "b", category: "shopping", amount: -1_000 }),
      tx({ id: "c", accountKind: "checking", amount: -5_000 }),
      tx({ id: "d", category: "income", amount: 5_000, kind: "deposit" }),
    ];
    expect(pointsSummary(rows)).toEqual({ points: 40, purchases: 2 });
    expect(pointsSummary(rows, { b: { category: "groceries" } })).toEqual({ points: 50, purchases: 2 });
  });
});
