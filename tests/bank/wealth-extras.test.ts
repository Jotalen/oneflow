import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { Analysis } from "@/lib/engine/analyze";
import type { BankAccount } from "@/lib/engine/types";
import { buildBankView } from "@/lib/bank/view";
import {
  cashParts, investmentParts, netWorthWithExtras, validateAsset, parseOwnedAssets,
  isFixedEssential, essentialKey, applyEssentialOverrides, essentialsTotal, parseEssentialOverrides, runway,
} from "@/lib/bank/wealth";

const load = (id: string) => { const a = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/snapshots", `${id}.json`), "utf8")) as Analysis; return { a, v: buildBankView(a) }; };
const acct = (over: Partial<BankAccount>): BankAccount => ({ id: "a", kind: "checking", nickname: "Everyday Checking", balance: 1_000, available: 1_000, ...over });

describe("cashParts", () => {
  test("one row per cash account, cards left out", () => {
    // Arrange
    const accounts = [acct({ id: "c" }), acct({ id: "s", kind: "savings", nickname: "Rainy Day Savings", balance: 500 }), acct({ id: "d", kind: "cd", nickname: "CD 12mo", balance: 9_000 }), acct({ id: "k", kind: "card", nickname: "Rewards Card" })];
    // Act
    const parts = cashParts(accounts);
    // Assert
    expect(parts.map((p) => [p.key, p.label, p.detail, p.value])).toEqual([
      ["acct:c", "Everyday Checking", "Checking", 1_000],
      ["acct:s", "Rainy Day Savings", "Savings", 500],
      ["acct:d", "CD 12mo", "Certificate of deposit", 9_000],
    ]);
  });
});

describe("investmentParts", () => {
  test("nothing when the customer has no investment account", () => {
    expect(investmentParts([acct({}), acct({ kind: "savings" })])).toEqual([]);
  });
  test("an investment account gets its own row", () => {
    const parts = investmentParts([{ id: "i", kind: "investment", nickname: "Brokerage", balance: 70_000 }]);
    expect(parts).toEqual([{ key: "acct:i", label: "Brokerage", detail: "Investments", value: 70_000 }]);
  });
});

describe("validateAsset", () => {
  test("accepts a name and a dollar value", () => {
    expect(validateAsset(" Boat ", "$12,500.50")).toEqual({ ok: true, name: "Boat", value: 1_250_050 });
  });
  test("rejects an empty name, a non-positive value or an absurd value", () => {
    expect(validateAsset("", "100").ok).toBe(false);
    expect(validateAsset("Ring", "0").ok).toBe(false);
    expect(validateAsset("Ring", "abc").ok).toBe(false);
    expect(validateAsset("Ring", "2000000000").ok).toBe(false);
  });
});

describe("parseOwnedAssets", () => {
  test("keeps well-formed assets and drops junk from storage", () => {
    const raw = JSON.stringify([{ id: "x", name: "Home", value: 30_000_000 }, { id: 1, name: "Bad" }, { id: "y", name: "Car", value: -5 }, null]);
    expect(parseOwnedAssets(raw)).toEqual([{ id: "x", name: "Home", value: 30_000_000 }]);
  });
  test("empty or corrupt storage is an empty list", () => {
    expect(parseOwnedAssets(null)).toEqual([]);
    expect(parseOwnedAssets("{not json")).toEqual([]);
    expect(parseOwnedAssets("{}")).toEqual([]);
  });
});

describe("netWorthWithExtras", () => {
  test("splits cash per account and adds the customer's own estimates", () => {
    // Arrange: C005 has checking, savings and a CD
    const { a, v } = load("C005");
    const assets = [{ id: "h", name: "Home", value: 25_000_000 }];
    // Act
    const nw = netWorthWithExtras(v.netWorth, a.profile.accounts, assets);
    // Assert
    const cashRows = nw.ownParts.filter((p) => p.key.startsWith("acct:"));
    expect(cashRows.map((p) => p.detail)).toEqual(["Checking", "Savings", "Certificate of deposit"]);
    expect(cashRows.reduce((s, p) => s + p.value, 0)).toBe(v.cash);
    expect(nw.ownParts.some((p) => p.key === "cash")).toBe(false);
    const home = nw.ownParts.find((p) => p.key === "asset:h");
    expect(home).toMatchObject({ label: "Home", detail: "Your estimate", value: 25_000_000, estimate: true });
    expect(nw.estimates).toBe(25_000_000);
    expect(nw.own).toBe(v.netWorth.own + 25_000_000);
    expect(nw.value).toBe(v.netWorth.value + 25_000_000);
    expect(nw.owe).toBe(v.netWorth.owe);
  });
  test("with no estimates the total matches the bank's own net worth", () => {
    const { a, v } = load("C001");
    const nw = netWorthWithExtras(v.netWorth, a.profile.accounts, []);
    expect(nw.value).toBe(v.netWorth.value);
    expect(nw.estimates).toBe(0);
    expect(nw.ownParts.some((p) => p.key === "car")).toBe(true);
  });
});

describe("essentials", () => {
  test("car, lease, loans, rent and debt payments are fixed; groceries and subscriptions are not", () => {
    for (const l of ["Car payment", "Car lease", "Other debt payments", "Rent", "Student loan"]) expect(isFixedEssential(l)).toBe(true);
    for (const l of ["Groceries", "Gas", "Health", "Phone & subscriptions"]) expect(isFixedEssential(l)).toBe(false);
  });
  test("essentialKey is a stable slug", () => {
    expect(essentialKey("Phone & subscriptions")).toBe("phone-subscriptions");
  });
  test("overrides change only flexible rows and keep the bank's estimate alongside", () => {
    // Arrange
    const base = [{ label: "Car payment", value: 66_851 }, { label: "Groceries", value: 40_000 }];
    // Act
    const items = applyEssentialOverrides(base, { "car-payment": 1, groceries: 30_000 });
    // Assert
    expect(items).toEqual([
      { key: "car-payment", label: "Car payment", value: 66_851, estimate: 66_851, fixed: true, adjusted: false },
      { key: "groceries", label: "Groceries", value: 30_000, estimate: 40_000, fixed: false, adjusted: true },
    ]);
    expect(essentialsTotal(items)).toBe(96_851);
  });
  test("an override equal to the estimate is not marked adjusted", () => {
    const [g] = applyEssentialOverrides([{ label: "Groceries", value: 40_000 }], { groceries: 40_000 });
    expect(g.adjusted).toBe(false);
  });
  test("parseEssentialOverrides drops negative, fractional and huge values", () => {
    const raw = JSON.stringify({ groceries: 30_000, gas: -1, health: 12.5, fun: 999_999_999, phone: "10" });
    expect(parseEssentialOverrides(raw)).toEqual({ groceries: 30_000 });
    expect(parseEssentialOverrides(null)).toEqual({});
    expect(parseEssentialOverrides("[1,2]")).toEqual({});
  });
});

describe("runway", () => {
  test("months to one decimal and whole days", () => {
    // 9.1 months of 30 days → 273 days
    expect(runway(910_000, 100_000)).toEqual({ months: 9.1, days: 273 });
  });
  test("no essentials means no runway figure", () => {
    expect(runway(100_000, 0)).toBeNull();
  });
  test("no cash is zero", () => {
    expect(runway(0, 100_000)).toEqual({ months: 0, days: 0 });
  });
});
