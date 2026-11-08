import { describe, expect, test } from "vitest";
import { buildProfile } from "@/lib/engine/normalize";
import type { NessieBundle } from "@/lib/engine/types";
import { loadToyota } from "@/lib/toyota/load";

const t = loadToyota();

function bundle(overrides: Partial<NessieBundle> = {}): NessieBundle {
  return {
    customer: { id: "cust1", first_name: "Priya", last_name: "Patel" },
    accounts: [
      { id: "chk", type: "Checking", nickname: "Everyday Checking", balance_cents: 250_000, available_cents: 240_000 },
      { id: "sav", type: "Savings", nickname: "Rainy Day Savings", balance_cents: 400_000, available_cents: 400_000 },
      { id: "cd", type: "Savings", nickname: "CD 12mo", balance_cents: 1_000_000, available_cents: 1_000_000 },
      { id: "card", type: "Credit Card", nickname: "Rewards Card", balance_cents: 120_000, available_cents: 380_000, credit_limit_cents: 500_000 },
    ],
    transactionsByAccount: {
      chk: [{ id: "t1", kind: "purchase", status: "completed", amount_cents: 4_500, merchant_id: "m1", description: "Tom Thumb" }],
      card: [{ id: "t2", kind: "purchase", status: "pending", amount_cents: 80_000, merchant_id: "m2", description: "Target" }],
    },
    bills: [
      { id: "b1", status: "recurring", payee: "Netflix", payment_amount: 15.99, recurring_date: 3, nickname: "Netflix" },
      { id: "b2", status: "recurring", payee: "Other Lender", payment_amount: 450, recurring_date: 1, nickname: "Other debt" },
    ],
    loans: [{ id: "l1", type: "lease", status: "active", monthly_payment_cents: 41_200, amount_cents: 1_667_000, description: "TFS RAV4 lease" }],
    ...overrides,
  };
}

describe("buildProfile", () => {
  test("C003 profile has a lease contract with no APR and car from CSV", () => {
    const p = buildProfile(bundle(), t, "C003");
    expect(p.contract?.type).toBe("lease");
    expect(p.contract?.aprPct).toBeUndefined();
    expect(p.car?.model).toBeTruthy();
    expect(p.source).toBe("nessie");
  });

  test("card account maps to both a BankAccount(card) and a Debt(card) with APR", () => {
    const p = buildProfile(bundle(), t, "C003");
    const acct = p.accounts.find((a) => a.kind === "card");
    const debt = p.debts.find((d) => d.kind === "card");
    expect(acct?.creditLimit).toBe(500_000);
    expect(debt?.balance).toBe(120_000);
    expect(debt?.aprPct).toBeGreaterThan(0);
  });

  test("savings nicknamed CD maps to kind cd", () => {
    const p = buildProfile(bundle(), t, "C003");
    expect(p.accounts.find((a) => a.id === "cd")?.kind).toBe("cd");
  });

  test("incomeMonthly is annual_income/12 in cents from the Toyota customer row", () => {
    const c003 = t.customers.find((c) => c.customer_id === "C003")!;
    const p = buildProfile(bundle(), t, "C003");
    expect(p.incomeMonthly).toBe(Math.round(c003.annual_income / 12));
    expect(p.paydayDay).toBe(c003.payday_day);
  });

  test("Toyota autopay bill is flagged as the vehicle payment mirror", () => {
    const b = bundle();
    b.bills.push({ id: "b3", status: "recurring", payee: "Toyota Financial Services", payment_amount: 412, recurring_date: 15 });
    const p = buildProfile(b, t, "C003");
    expect(p.bills.find((x) => x.id === "b3")?.isVehiclePayment).toBe(true);
    expect(p.bills.find((x) => x.payee === "Netflix")?.isVehiclePayment).toBe(false);
  });

  test("Netflix bill is a subscription; Other Lender is not", () => {
    const p = buildProfile(bundle(), t, "C003");
    expect(p.bills.find((b) => b.payee === "Netflix")?.isSubscription).toBe(true);
    expect(p.bills.find((b) => b.payee === "Other Lender")?.isSubscription).toBe(false);
    expect(p.bills.find((b) => b.payee === "Netflix")?.amount).toBe(1599);
  });

  test("missing Nessie loan does not throw; contract still comes from CSV", () => {
    const p = buildProfile(bundle({ loans: [] }), t, "C003");
    expect(p.contract?.payoffQuote).toBeGreaterThan(0);
    expect(p.debts.find((d) => d.kind === "auto_lease")).toBeDefined();
  });

  test("C014 flags: vulnerable, 2 missed, consent from CSV; C011 consent N", () => {
    expect(buildProfile(bundle(), t, "C014").flags).toMatchObject({ vulnerable: true, missed12m: 2 });
    expect(buildProfile(bundle(), t, "C011").flags.marketingConsent).toBe(false);
  });

  test("recent transactions are flattened with account ids", () => {
    const p = buildProfile(bundle(), t, "C003");
    expect(p.recentTxns).toHaveLength(2);
    expect(p.recentTxns.find((x) => x.id === "t2")?.accountId).toBe("card");
  });

  test("unknown persona throws a clear error", () => {
    expect(() => buildProfile(bundle(), t, "C999")).toThrow(/C999/);
  });
});
