import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { Analysis } from "@/lib/engine/analyze";
import type { Profile } from "@/lib/engine/types";
import { project } from "@/lib/engine/project";
import { health } from "@/lib/engine/health";
import {
  EMPTY_SCENARIO, HORIZON_MONTHS, cancellableBills, cashLow, debtTargets, describeScenario, healthAtMonth,
  indicatorChanges, isEmptyScenario, monthLabel, runOutMonth, runWhatIf, scenarioToOverrides, chartRows, type Scenario,
} from "@/lib/bank/whatif";
import { profileFor } from "../fixtures/profiles";

const load = (id: string): Profile => (JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/snapshots", `${id}.json`), "utf8")) as Analysis).profile;
const scenario = (over: Partial<Scenario>): Scenario => ({ ...EMPTY_SCENARIO, ...over });

describe("scenarioToOverrides", () => {
  test("empty scenario maps to no overrides, so it equals the do-nothing projection", () => {
    // Arrange
    const p = load("C018");
    // Act
    const o = scenarioToOverrides(p, EMPTY_SCENARIO);
    // Assert
    expect(o).toEqual({});
    expect(project(p, HORIZON_MONTHS, o)).toEqual(project(p));
  });

  test("maps every slider to the engine override it drives", () => {
    const p = load("C018");
    const bill = cancellableBills(p)[0];
    const o = scenarioToOverrides(p, scenario({
      incomeMonthlyDelta: -100_000, expenseAmount: 300_000, expenseMonth: 4,
      extraToDebtMonthly: 20_000, extraToDebtTargetId: "contract", cancelBillIds: [bill.id], newBillMonthly: 15_000,
    }));
    expect(o).toEqual({
      incomeMonthlyDelta: -100_000, oneTimeExpense: { month: 4, amount: 300_000 },
      extraToDebtMonthly: 20_000, extraToDebtTargetId: "contract", cancelBillIds: [bill.id], addBillsMonthly: 15_000,
    });
  });

  test("clamps income loss to the whole income and expense month to the horizon", () => {
    const p = load("C018");
    const o = scenarioToOverrides(p, scenario({ incomeMonthlyDelta: -99_999_999, expenseAmount: 1_000, expenseMonth: 99 }));
    expect(o.incomeMonthlyDelta).toBe(-p.incomeMonthly);
    expect(o.oneTimeExpense).toEqual({ month: HORIZON_MONTHS, amount: 1_000 });
    expect(scenarioToOverrides(p, scenario({ expenseAmount: 1_000, expenseMonth: 0 })).oneTimeExpense?.month).toBe(1);
  });

  test("drops unknown bill ids, unknown debt targets and negative amounts", () => {
    const p = load("C018");
    const o = scenarioToOverrides(p, scenario({ cancelBillIds: ["nope"], extraToDebtMonthly: 5_000, extraToDebtTargetId: "nope", expenseAmount: -5, newBillMonthly: -5 }));
    expect(o).toEqual({ extraToDebtMonthly: 5_000 });
  });

  test("never lets a vehicle autopay or debt-payment bill be cancelled", () => {
    const p = load("C018");
    const locked = p.bills.filter((b) => b.isVehiclePayment || b.isDebtPayment).map((b) => b.id);
    expect(locked.length).toBeGreaterThan(0);
    expect(scenarioToOverrides(p, scenario({ cancelBillIds: locked }))).toEqual({});
  });
});

describe("pickers", () => {
  test("debtTargets lists the car loan as 'contract' plus cards with a balance, highest APR first", () => {
    const t = debtTargets(load("C018"));
    expect(t.map((d) => d.id)).toEqual(["acct_01m6w9qwj3p20ar6nadr8ge2cz", "contract"]);
    expect(t[1].label).toBe("2024 RAV4 loan");
  });

  test("debtTargets excludes a lease (no principal to pay down)", () => {
    const t = debtTargets(load("C003"));
    expect(t.some((d) => d.id === "contract")).toBe(false);
    expect(t).toHaveLength(1);
  });

  test("cancellableBills are the real recurring bills that are not loan or car payments", () => {
    expect(cancellableBills(load("C018")).map((b) => b.label)).toEqual(["T-Mobile", "Netflix"]);
  });
});

describe("projection readouts", () => {
  test("cashLow finds the lowest liquid point and its month", () => {
    const pr = project(load("C018"), 24, { oneTimeExpense: { month: 5, amount: 1_000_000 } });
    const low = cashLow(pr);
    expect(low.liquid).toBe(Math.min(...pr.points.map((x) => x.liquid)));
    expect(pr.points[low.month].liquid).toBe(low.liquid);
  });

  test("runOutMonth is the first month cash goes below zero, or null", () => {
    const p = load("C018");
    expect(runOutMonth(project(p))).toBeNull();
    const loss = project(p, 24, { incomeMonthlyDelta: -p.incomeMonthly });
    const m = runOutMonth(loss)!;
    expect(loss.points[m].liquid).toBeLessThan(0);
    expect(loss.points[m - 1].liquid).toBeGreaterThanOrEqual(0);
  });

  test("monthLabel counts calendar months from the as-of date (Nov 2026)", () => {
    expect(monthLabel(1)).toBe("Dec 2026");
    expect(monthLabel(9)).toBe("Aug 2027");
    expect(monthLabel(24)).toBe("Nov 2028");
  });

  test("chartRows pairs baseline and scenario in dollars for each month", () => {
    const p = load("C018");
    const base = project(p);
    const scen = project(p, 24, { incomeMonthlyDelta: 50_000 });
    const rows = chartRows(base, scen);
    expect(rows).toHaveLength(25);
    expect(rows[24]).toEqual({ month: 24, baseNetWorth: base.points[24].netWorth / 100, scenNetWorth: scen.points[24].netWorth / 100, baseCash: base.points[24].liquid / 100, scenCash: scen.points[24].liquid / 100 });
  });
});

describe("healthAtMonth", () => {
  test("uses projected cash and the scenario's monthly flows; does not mutate the profile", () => {
    const p = load("C018");
    const before = JSON.stringify(p);
    const s = scenario({ incomeMonthlyDelta: -100_000 });
    const pr = project(p, 24, scenarioToOverrides(p, s));
    const h = healthAtMonth(p, s, pr, 24);
    expect(JSON.stringify(p)).toBe(before);
    expect(h.dtiPct).toBeGreaterThan(health(p).dtiPct);
    expect(h.shockResilient).toBe(pr.points[24].liquid >= 150_000);
  });

  test("cancelling a subscription lowers subscription burden", () => {
    const p = load("C018");
    const s = scenario({ cancelBillIds: cancellableBills(p).map((b) => b.id) });
    const h = healthAtMonth(p, s, project(p, 24, scenarioToOverrides(p, s)), 24);
    expect(h.subscriptionBurdenPct).toBe(0);
  });

  test("negative projected cash means zero runway, not a negative one", () => {
    const p = load("C018");
    const s = scenario({ incomeMonthlyDelta: -p.incomeMonthly });
    expect(healthAtMonth(p, s, project(p, 24, scenarioToOverrides(p, s)), 24).runwayMonths).toBe(0);
  });
});

describe("indicatorChanges", () => {
  test("flags direction by whether higher is better for each indicator", () => {
    const p = load("C018");
    const base = health(p);
    const worse = { ...base, dtiPct: base.dtiPct + 5, runwayMonths: base.runwayMonths - 1, shockResilient: false };
    const rows = indicatorChanges(base, worse, { hasContract: true, baseIncome: 1, scenarioIncome: 1 });
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(byKey.dtiPct.direction).toBe("worse");
    expect(byKey.runwayMonths.direction).toBe("worse");
    expect(byKey.shockResilient.direction).toBe("worse");
    expect(byKey.savingsRatePct.direction).toBe("same");
  });

  test("omits the car payment indicator when there is no vehicle contract", () => {
    const h = health(load("C018"));
    expect(indicatorChanges(h, h, { hasContract: false, baseIncome: 1, scenarioIncome: 1 }).some((r) => r.key === "ptiPct")).toBe(false);
  });

  test("with no income, income ratios read 'No income' and count as worse, not a 0% improvement", () => {
    const p = load("C018");
    const r = runWhatIf(p, scenario({ incomeMonthlyDelta: -p.incomeMonthly }));
    const byKey = Object.fromEntries(r.changes.map((c) => [c.key, c]));
    for (const k of ["dtiPct", "ptiPct", "subscriptionBurdenPct", "savingsRatePct"]) {
      expect(byKey[k].scenario).toBe("No income");
      expect(byKey[k].direction).toBe("worse");
    }
  });
});

describe("describeScenario", () => {
  test("turns each change into plain words", () => {
    const p = load("C018");
    const [netflix] = cancellableBills(p).filter((b) => b.label === "Netflix");
    const parts = describeScenario(p, scenario({
      incomeMonthlyDelta: -100_000, expenseAmount: 300_000, expenseMonth: 4,
      extraToDebtMonthly: 20_000, extraToDebtTargetId: "contract", cancelBillIds: [netflix.id], newBillMonthly: 15_000,
    }));
    expect(parts).toEqual([
      "lose $1,000/mo of income", "pay a one-time $3,000 in month 4", "put an extra $200/mo toward your 2024 RAV4 loan",
      "cancel Netflix", "add a new $150/mo bill",
    ]);
  });

  test("a raise reads as earning more", () => {
    expect(describeScenario(load("C018"), scenario({ incomeMonthlyDelta: 50_000 }))).toEqual(["earn $500/mo more"]);
  });
});

describe("runWhatIf", () => {
  test("empty scenario: zero deltas and a do-nothing summary", () => {
    const r = runWhatIf(load("C018"), EMPTY_SCENARIO);
    expect(isEmptyScenario(EMPTY_SCENARIO)).toBe(true);
    expect(r.netWorthDelta24).toBe(0);
    expect(r.scenario).toEqual(r.baseline);
    expect(r.summary).toMatch(/^Doing nothing/);
  });

  test("job loss: summary names the computed run-out month and it matches the projection", () => {
    const p = load("C018");
    const r = runWhatIf(p, scenario({ incomeMonthlyDelta: -p.incomeMonthly }));
    const m = runOutMonth(r.scenario)!;
    expect(r.runOut.scenario).toBe(m);
    expect(r.summary).toContain(`you run out of cash in month ${m} (${monthLabel(m)})`);
    expect(r.fees.scenario).toBeGreaterThan(0);
    expect(r.netWorthDelta24).toBe(r.scenario.netWorth24 - r.baseline.netWorth24);
  });

  test("a raise: summary says how much higher net worth is at month 24", () => {
    const r = runWhatIf(load("C018"), scenario({ incomeMonthlyDelta: 50_000 }));
    expect(r.netWorthDelta24).toBeGreaterThan(0);
    expect(r.summary).toMatch(/^If you earn \$500\/mo more, your net worth in 24 months is \$[\d,]+ higher than doing nothing/);
  });

  test("works for a typical fixture profile and a lease persona without throwing", () => {
    expect(() => runWhatIf(profileFor("C003"), scenario({ expenseAmount: 300_000, expenseMonth: 3 }))).not.toThrow();
    expect(runWhatIf(load("C003"), scenario({ extraToDebtMonthly: 10_000 })).changes.some((c) => c.key === "ptiPct")).toBe(true);
  });
});
