import { describe, expect, test } from "vitest";
import { amortize, remainingBalance } from "@/lib/engine/amortize";
import { toyota } from "../fixtures/profiles";

describe("amortize", () => {
  test("C001 REFI payment reproduces option_scenarios within $1", () => {
    const contract = toyota.accounts.find((a) => a.customer_id === "C001")!;
    const refi = toyota.options.find((o) => o.customer_id === "C001" && o.option_id === "REFI")!;
    const rate = toyota.rates.find((r) => r.credit_tier === toyota.customers.find((c) => c.customer_id === "C001")!.credit_tier_now && r.term_months === 48)!;
    const payment = amortize(contract.current_balance!, rate.refinance_apr, contract.months_remaining);
    expect(Math.abs(payment - refi.new_monthly_payment!)).toBeLessThanOrEqual(100);
  });

  test("zero APR returns principal divided by term", () => {
    expect(amortize(120_000, 0, 12)).toBe(10_000);
  });

  test("remainingBalance after full term is ~0", () => {
    const pmt = amortize(1_000_000, 6, 36);
    expect(Math.abs(remainingBalance(1_000_000, 6, pmt, 36))).toBeLessThan(200);
  });

  test("remainingBalance after 0 months is principal", () => {
    expect(remainingBalance(1_000_000, 6, 30_000, 0)).toBe(1_000_000);
  });
});
