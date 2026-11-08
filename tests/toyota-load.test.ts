import { describe, expect, test } from "vitest";
import { toCents, toDollars, fmtUSD } from "@/lib/money";
import { loadToyota } from "@/lib/toyota/load";

describe("money", () => {
  test("toCents rounds dollars to integer cents", () => {
    expect(toCents(12.34)).toBe(1234);
    expect(toCents(0.1 + 0.2)).toBe(30);
  });
  test("toDollars inverts toCents", () => {
    expect(toDollars(1234)).toBe(12.34);
  });
  test("fmtUSD formats cents as US dollars", () => {
    expect(fmtUSD(123456)).toBe("$1,234.56");
    expect(fmtUSD(-500)).toBe("-$5.00");
  });
});

describe("loadToyota", () => {
  const t = loadToyota();

  test("loads 20 customers, 142 options, 20 golden answers", () => {
    expect(t.customers).toHaveLength(20);
    expect(t.options).toHaveLength(142);
    expect(t.golden).toHaveLength(20);
    expect(t.vehicles).toHaveLength(20);
    expect(t.accounts).toHaveLength(20);
  });

  test("C001 REFI option new_monthly_payment is integer cents", () => {
    const refi = t.options.find((o) => o.customer_id === "C001" && o.option_id === "REFI");
    expect(refi).toBeDefined();
    expect(Number.isInteger(refi!.new_monthly_payment)).toBe(true);
    expect(refi!.new_monthly_payment).toBeGreaterThan(10000); // > $100
  });

  test("C003 contract_type is lease", () => {
    const c003 = t.accounts.find((a) => a.customer_id === "C003");
    expect(c003?.contract_type).toBe("lease");
  });

  test("C014 is vulnerable with 2 missed payments", () => {
    const cust = t.customers.find((c) => c.customer_id === "C014");
    const acct = t.accounts.find((a) => a.customer_id === "C014");
    expect(cust?.vulnerable_flag).toBe("Y");
    expect(acct?.missed_payments_12m).toBe(2);
  });

  test("annual_income is stored in cents", () => {
    const c001 = t.customers.find((c) => c.customer_id === "C001");
    expect(c001?.annual_income).toBe(5800000);
  });
});
