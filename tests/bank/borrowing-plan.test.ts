import { describe, expect, test } from "vitest";
import { amountToFinance, carCatalog, compareStrategies, simulatePayoff, type PayoffDebt } from "@/lib/bank/borrowing";
import { payoffWithExtra } from "@/lib/bank/view";
import type { ToyotaVehicle } from "@/lib/toyota/types";

describe("amountToFinance (trade-in)", () => {
  test("positive equity is SUBTRACTED from the amount financed", () => {
    // C018: $30,000 RAV4 − $3,000 down − $3,760.56 equity ($21,450 value − $17,689.44 payoff)
    expect(amountToFinance({ price: 3_000_000, down: 300_000, tradeEquity: 2_145_000 - 1_768_944, useTrade: true })).toBe(2_323_944);
  });
  test("negative equity (owe more than it's worth) is ADDED", () => {
    // C001: $22,700 value − $23,167.35 payoff = −$467.35
    expect(amountToFinance({ price: 3_000_000, down: 300_000, tradeEquity: -46_735, useTrade: true })).toBe(2_746_735);
  });
  test("unchecked trade-in, or no car, is ignored", () => {
    expect(amountToFinance({ price: 3_000_000, down: 300_000, tradeEquity: 376_056, useTrade: false })).toBe(2_700_000);
    expect(amountToFinance({ price: 3_000_000, down: 300_000, tradeEquity: null, useTrade: true })).toBe(2_700_000);
  });
  test("never below zero", () => {
    expect(amountToFinance({ price: 500_000, down: 300_000, tradeEquity: 376_056, useTrade: true })).toBe(0);
  });
});

const veh = (over: Partial<ToyotaVehicle>): ToyotaVehicle => ({
  vehicle_id: "V", customer_id: "C", model_year: 2024, model: "RAV4", trim: "LE", condition_at_purchase: "New",
  purchase_price_or_msrp: 3_000_000, odometer_now: 0, annual_miles_est: 0, est_market_value_now: 0,
  toyota_care_ends: "", basic_warranty_ends: "", last_service_date: "", next_service_due: "", open_recall: "N", ...over,
});

describe("carCatalog", () => {
  test("new Toyotas from the data pack, one per model + trim (newest year), sorted by model then price", () => {
    const list = carCatalog([
      veh({ model: "RAV4", trim: "LE", model_year: 2024, purchase_price_or_msrp: 3_000_000 }),
      veh({ model: "Camry", trim: "SE", model_year: 2025, purchase_price_or_msrp: 2_980_000 }),
      veh({ model: "Camry", trim: "LE", model_year: 2022, purchase_price_or_msrp: 2_850_000 }),
      veh({ model: "RAV4", trim: "LE", model_year: 2023, purchase_price_or_msrp: 2_900_000 }),
      veh({ model: "Corolla", trim: "L", condition_at_purchase: "Used", purchase_price_or_msrp: 1_890_000 }),
    ]);
    expect(list.map((c) => c.id)).toEqual(["2022-camry-le", "2025-camry-se", "2024-rav4-le"]);
    expect(list[2]).toEqual({ id: "2024-rav4-le", label: "2024 Toyota RAV4 LE", model: "RAV4", trim: "LE", year: 2024, price: 3_000_000 });
  });
});

// C018 snapshot debts: RAV4 loan and Rewards Card; $311.27/mo extra from the ranked engine move.
const C018_DEBTS: PayoffDebt[] = [
  { id: "A018", label: "2024 RAV4 loan", balance: 1_757_811, aprPct: 7.6, minPayment: 60_859 },
  { id: "card", label: "Rewards Card", balance: 373_526, aprPct: 22.99, minPayment: 7_471 },
];
const C018_EXTRA = 31_127;

describe("simulatePayoff", () => {
  test("minimums only matches paying each debt on its own", () => {
    const r = simulatePayoff(C018_DEBTS, 0, "minimums");
    const car = payoffWithExtra(1_757_811, 7.6, 60_859, 0);
    const card = payoffWithExtra(373_526, 22.99, 7_471, 0);
    expect(r.months).toBe(Math.max(car.months, card.months));
    expect(r.interest).toBe(car.interest + card.interest);
  });
  test("a minimum that never covers interest returns null", () => {
    const r = simulatePayoff([{ id: "x", label: "x", balance: 1_000_000, aprPct: 30, minPayment: 20_000 }], 0, "minimums");
    expect(r).toMatchObject({ months: null, interest: null });
  });
  test("avalanche targets the highest APR, snowball the smallest balance", () => {
    const debts: PayoffDebt[] = [
      { id: "small", label: "small", balance: 100_000, aprPct: 5, minPayment: 5_000 },
      { id: "pricey", label: "pricey", balance: 500_000, aprPct: 25, minPayment: 15_000 },
    ];
    const av = simulatePayoff(debts, 20_000, "avalanche");
    const sn = simulatePayoff(debts, 20_000, "snowball");
    expect(av.order).toEqual(["pricey", "small"]);
    expect(sn.order).toEqual(["small", "pricey"]);
    expect(av.interest!).toBeLessThan(sn.interest!);
  });
});

describe("compareStrategies", () => {
  test("C018: savings and months sooner are measured against minimums only", () => {
    const rows = compareStrategies(C018_DEBTS, C018_EXTRA);
    expect(rows.map((r) => r.strategy)).toEqual(["avalanche", "snowball", "minimums"]);
    const min = rows[2];
    for (const r of rows.slice(0, 2)) {
      expect(r.interestSaved).toBe(min.interest! - r.interest!);
      expect(r.monthsSooner).toBe(min.months! - r.months!);
      expect(r.interestSaved!).toBeGreaterThan(0);
      expect(r.monthsSooner!).toBeGreaterThan(0);
    }
    expect(min.interestSaved).toBe(0);
    expect(min.monthsSooner).toBe(0);
  });
  test("when minimums never finish, savings are null rather than invented", () => {
    const rows = compareStrategies([{ id: "x", label: "x", balance: 1_000_000, aprPct: 30, minPayment: 20_000 }], 20_000);
    expect(rows[0].months).not.toBeNull();
    expect(rows[0].interestSaved).toBeNull();
    expect(rows[0].monthsSooner).toBeNull();
  });
  test("no debts: empty", () => {
    expect(compareStrategies([], 10_000)).toEqual([]);
  });
});
