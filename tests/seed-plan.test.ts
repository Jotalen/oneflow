import { describe, expect, test } from "vitest";
import { planBank, syntheticBundle } from "@/lib/seed/plan";
import { buildProfile } from "@/lib/engine/normalize";
import { toyota } from "./fixtures/profiles";

const rowsFor = (id: string) => ({
  cust: toyota.customers.find((c) => c.customer_id === id)!,
  contract: toyota.accounts.find((a) => a.customer_id === id)!,
  vehicle: toyota.vehicles.find((v) => v.customer_id === id)!,
});

describe("planBank", () => {
  test("is deterministic for the same persona", () => {
    const { cust, contract, vehicle } = rowsFor("C003");
    const a = planBank(cust, contract, vehicle, 2);
    const b = planBank(cust, contract, vehicle, 2);
    expect(a).toEqual(b);
  });

  test("40 purchases summing to roughly two months of discretionary spend", () => {
    const { cust, contract, vehicle } = rowsFor("C003");
    const plan = planBank(cust, contract, vehicle, 2);
    expect(plan.purchases).toHaveLength(40);
    const sum = plan.purchases.reduce((s, p) => s + p.amount, 0);
    expect(sum).toBeGreaterThan(plan.discretionaryMonthly * 1.4);
    expect(sum).toBeLessThan(plan.discretionaryMonthly * 2.6);
  });

  test("8 paychecks of annual_income/26", () => {
    const { cust, contract, vehicle } = rowsFor("C001");
    const plan = planBank(cust, contract, vehicle, 0);
    expect(plan.deposits.count).toBe(8);
    expect(plan.deposits.amount).toBe(Math.round(cust.annual_income / 26));
  });

  test("C005 gets a CD account; C003 does not", () => {
    const c5 = rowsFor("C005");
    const c3 = rowsFor("C003");
    expect(planBank(c5.cust, c5.contract, c5.vehicle, 4).accounts.some((a) => a.kind === "cd")).toBe(true);
    expect(planBank(c3.cust, c3.contract, c3.vehicle, 2).accounts.some((a) => a.kind === "cd")).toBe(false);
  });

  test("autopay Y adds a TFS bill; Low engagement keeps only the phone subscription", () => {
    const low = toyota.customers.find((c) => c.digital_engagement === "Low")!;
    const r = rowsFor(low.customer_id);
    const plan = planBank(r.cust, r.contract, r.vehicle, 0);
    const subs = plan.bills.filter((b) => /netflix|spotify|planet/i.test(b.payee));
    expect(subs).toHaveLength(0);
    expect(plan.bills.some((b) => /t-mobile/i.test(b.payee))).toBe(true);
    const auto = toyota.customers.find((c) => c.autopay === "Y")!;
    const ra = rowsFor(auto.customer_id);
    expect(planBank(ra.cust, ra.contract, ra.vehicle, 1).bills.some((b) => /toyota/i.test(b.payee))).toBe(true);
  });

  test("syntheticBundle renders the plan as a NessieBundle that buildProfile accepts", () => {
    const { cust, contract, vehicle } = rowsFor("C003");
    const bundle = syntheticBundle(planBank(cust, contract, vehicle, 2), "C003");
    const p = buildProfile(bundle, toyota, "C003");
    expect(p.accounts.length).toBeGreaterThanOrEqual(3);
    expect(p.recentTxns.filter((t) => t.kind === "purchase")).toHaveLength(40);
    expect(p.bills.length).toBeGreaterThan(0);
    expect(p.debts.find((d) => d.kind === "card")).toBeDefined();
  });
});
