import { describe, expect, test } from "vitest";
import type { LedgerTxn } from "@/lib/bank/view";
import {
  filterLedger, groupByDay, ledgerCsv, monthlySpend, pointsForTxn,
  parseDollarInput, AMOUNT_FILTERS,
} from "@/lib/bank/everyday";

const tx = (o: Partial<LedgerTxn>): LedgerTxn => ({
  id: "t1", accountId: "a1", accountKind: "card", accountLabel: "Rewards Card", date: "2026-11-06",
  merchant: "Amazon", category: "shopping", amount: -6499, status: "completed", kind: "purchase", ...o,
});

const ledger: LedgerTxn[] = [
  tx({ id: "a", date: "2026-11-07", merchant: "Starbucks", category: "food", amount: -1248 }),
  tx({ id: "b", date: "2026-11-06", merchant: "Amazon", category: "shopping", amount: -6499 }),
  tx({ id: "c", date: "2026-11-06", merchant: "Paycheck", category: "income", amount: 125000, accountKind: "checking", accountId: "a2", accountLabel: "Checking", kind: "deposit" }),
  tx({ id: "d", date: "2026-10-02", merchant: "QuikTrip", category: "gas", amount: -3820 }),
  tx({ id: "e", date: "2026-09-20", merchant: "Tom Thumb", category: "groceries", amount: -15000, accountKind: "checking", accountId: "a2" }),
];

describe("filterLedger", () => {
  test("returns everything with no filters", () => {
    expect(filterLedger(ledger, {}).map((t) => t.id)).toEqual(["a", "b", "c", "d", "e"]);
  });
  test("matches merchant, category label and amount text, case-insensitive", () => {
    expect(filterLedger(ledger, { q: "amaz" }).map((t) => t.id)).toEqual(["b"]);
    expect(filterLedger(ledger, { q: "food & drink" }).map((t) => t.id)).toEqual(["a"]);
    expect(filterLedger(ledger, { q: "64.99" }).map((t) => t.id)).toEqual(["b"]);
  });
  test("filters by account, category and amount bucket", () => {
    expect(filterLedger(ledger, { accountId: "a2" }).map((t) => t.id)).toEqual(["c", "e"]);
    expect(filterLedger(ledger, { category: "gas" }).map((t) => t.id)).toEqual(["d"]);
    expect(filterLedger(ledger, { amount: "under25" }).map((t) => t.id)).toEqual(["a"]);
    expect(filterLedger(ledger, { amount: "over100" }).map((t) => t.id)).toEqual(["c", "e"]);
    expect(AMOUNT_FILTERS.map((f) => f.value)).toContain("any");
  });
});

describe("groupByDay", () => {
  test("groups consecutive dates keeping order", () => {
    const g = groupByDay(ledger);
    expect(g.map((x) => x.date)).toEqual(["2026-11-07", "2026-11-06", "2026-10-02", "2026-09-20"]);
    expect(g[1].txns.map((t) => t.id)).toEqual(["b", "c"]);
  });
});

describe("ledgerCsv", () => {
  test("header plus one row per txn, quoting commas and quotes", () => {
    const csv = ledgerCsv([tx({ merchant: 'Shop, "Inc"', amount: -1234 })], { t1: { note: "gift" } });
    const lines = csv.split("\n");
    expect(lines[0]).toBe("date,merchant,account,category,amount,note");
    expect(lines[1]).toBe('2026-11-06,"Shop, ""Inc""",Rewards Card,Shopping,-12.34,gift');
  });
  test("uses overridden category", () => {
    expect(ledgerCsv([tx({})], { t1: { category: "entertainment" } }).split("\n")[1]).toContain(",Entertainment,");
  });
});

describe("monthlySpend", () => {
  test("only months with data, oldest first, spending only (no income/transfers)", () => {
    const out = monthlySpend([...ledger, tx({ id: "x", category: "transfer", amount: -99999, date: "2026-11-01" })]);
    expect(out).toEqual([
      { month: "2026-09", spent: 15000 },
      { month: "2026-10", spent: 3820 },
      { month: "2026-11", spent: 7747 },
    ]);
  });
});

describe("rewards helpers", () => {
  test("pointsForTxn: card purchases only, at the category rate", () => {
    expect(pointsForTxn(tx({ category: "food", amount: -1248 }))).toBe(37);
    expect(pointsForTxn(tx({ category: "shopping", amount: -6499 }))).toBe(65);
    expect(pointsForTxn(tx({ accountKind: "checking" }))).toBe(0);
  });
});

describe("parseDollarInput", () => {
  test("parses positive dollar strings into cents", () => {
    expect(parseDollarInput("12.5")).toBe(1250);
    expect(parseDollarInput("$1,000")).toBe(100000);
    expect(parseDollarInput("0")).toBeNull();
    expect(parseDollarInput("-3")).toBeNull();
    expect(parseDollarInput("abc")).toBeNull();
  });
});

describe("all 20 persona snapshots", () => {
  test("helpers run without throwing and keep totals consistent", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { buildBankView } = await import("@/lib/bank/view");
    for (let i = 1; i <= 20; i++) {
      const id = `C${String(i).padStart(3, "0")}`;
      const a = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/snapshots", `${id}.json`), "utf8"));
      const v = buildBankView(a);
      expect(groupByDay(v.ledger).reduce((s, g) => s + g.txns.length, 0)).toBe(v.ledger.length);
      expect(monthlySpend(v.ledger).every((m) => m.spent > 0)).toBe(true);
      expect(ledgerCsv(v.ledger).split("\n").length).toBe(v.ledger.length + 1);
    }
  });
});
