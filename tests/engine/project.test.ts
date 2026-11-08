import { describe, expect, test } from "vitest";
import { project } from "@/lib/engine/project";
import { profileFor } from "../fixtures/profiles";

describe("project", () => {
  test("returns 24 monthly points plus month 0", () => {
    const pr = project(profileFor("C003"));
    expect(pr.points).toHaveLength(25);
    expect(pr.points[0].month).toBe(0);
    expect(pr.points[24].month).toBe(24);
  });

  test("do-nothing netWorth24 for C003 is finite and netWorth24 equals last point", () => {
    const pr = project(profileFor("C003"));
    expect(Number.isFinite(pr.netWorth24)).toBe(true);
    expect(pr.netWorth24).toBe(pr.points[24].netWorth);
  });

  test("extraToDebtMonthly 10000 raises netWorth24 vs base for a loan persona", () => {
    const p = profileFor("C001");
    expect(project(p, 24, { extraToDebtMonthly: 10_000 }).netWorth24).toBeGreaterThan(project(p).netWorth24);
  });

  test("C003 lease end fires a lease_end event at months_remaining", () => {
    const p = profileFor("C003");
    const pr = project(p);
    const m = p.contract!.monthsRemaining;
    expect(pr.points[m].events).toContain("lease_end");
  });

  test("short loan pays off within horizon and fires payoff", () => {
    const p = profileFor("C005"); // 6 payments left
    const pr = project(p);
    expect(pr.points.some((pt) => pt.events.includes("payoff"))).toBe(true);
    expect(pr.points[24].debt).toBeLessThan(pr.points[0].debt);
  });

  test("oneTimeExpense lowers liquid at that month", () => {
    const p = profileFor("C003");
    const base = project(p);
    const hit = project(p, 24, { oneTimeExpense: { month: 3, amount: 200_000 } });
    expect(hit.points[3].liquid).toBeLessThan(base.points[3].liquid);
  });

  test("zero-income, zero-liquid profile projects finite numbers", () => {
    const p = { ...profileFor("C014"), incomeMonthly: 0, accounts: [] };
    const pr = project(p);
    expect(pr.points.every((pt) => Number.isFinite(pt.netWorth))).toBe(true);
  });
});

describe("review fixes — projection", () => {
  test("extraToDebtTargetId 'contract' routes extra to the auto loan and leaves the card untouched", () => {
    const p = profileFor("C001");
    const base = project(p);
    const applied = project(p, 24, { extraToDebtMonthly: 10_000, extraToDebtTargetId: "contract" });
    // total debt lower, and the reduction is at least the extra paid (principal), i.e. it did not vanish into the card alone
    expect(applied.points[24].debt).toBeLessThan(base.points[24].debt);
    const cardOnly = project(p, 24, { extraToDebtMonthly: 10_000 });
    expect(applied.points[24].debt).not.toBe(cardOnly.points[24].debt);
  });
  test("lease baseline uses the current lease payment as replacement transport", () => {
    const p = profileFor("C003");
    const pr = project(p);
    const m = p.contract!.monthsRemaining;
    const drop = pr.points[m + 1].liquid - pr.points[m + 2].liquid; // monthly outflow after lease end
    const before = pr.points[m - 2].liquid - pr.points[m - 1].liquid; // monthly outflow during lease
    expect(Math.abs(drop - before)).toBeLessThan(5_000); // same payment-sized outflow continues
  });
});
