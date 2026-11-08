import { describe, expect, test } from "vitest";
import { health } from "@/lib/engine/health";
import { brokeBundle, profileFor } from "../fixtures/profiles";

describe("health", () => {
  test("C014 with zero liquid returns runwayMonths 0, not NaN", () => {
    const h = health(profileFor("C014", brokeBundle()));
    expect(h.runwayMonths).toBe(0);
    expect(Number.isNaN(h.runwayMonths)).toBe(false);
    expect(h.shockResilient).toBe(false);
  });

  test("zero income yields finite ratios", () => {
    const h = health({ ...profileFor("C003"), incomeMonthly: 0 });
    expect(Number.isFinite(h.dtiPct)).toBe(true);
    expect(Number.isFinite(h.ptiPct)).toBe(true);
    expect(Number.isFinite(h.savingsRatePct)).toBe(true);
  });

  test("C003 lease carEquityRatio = estEquity / marketValue", () => {
    const p = profileFor("C003");
    const h = health(p);
    expect(h.carEquityRatio).toBeCloseTo(p.contract!.estEquity / p.car!.marketValue, 4);
  });

  test("utilizationPct is card balance over limit", () => {
    expect(health(profileFor("C003")).utilizationPct).toBeCloseTo(30, 1);
  });

  test("runway = liquid / essential spend, positive for typical bundle", () => {
    const h = health(profileFor("C003"));
    expect(h.runwayMonths).toBeGreaterThan(0);
    expect(h.shockResilient).toBe(true); // 800k liquid >= 150k
  });

  test("subscription burden counts Netflix and T-Mobile, not Other Lender", () => {
    const p = profileFor("C003");
    const h = health(p);
    expect(h.subscriptionBurdenPct).toBeCloseTo(((1599 + 8500) / p.incomeMonthly) * 100, 3);
  });

  test("ptiPct uses the vehicle payment and matches the CSV within 0.5 pt", () => {
    const p = profileFor("C001");
    const h = health(p);
    const csv = profileFor("C001") && 13.8;
    expect(Math.abs(h.ptiPct - csv)).toBeLessThan(0.5);
  });
});
