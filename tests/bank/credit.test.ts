import { describe, expect, test } from "vitest";
import {
  creditFactors, creditGoalPlan, creditSteps, estimateCreditAgeYears, estimateDerogatoryMarks, estimateHardInquiries,
  monthsBetween, parseCreditGoal, type CreditInputs,
} from "@/lib/bank/credit";
import { estimateCreditScore } from "@/lib/bank/view";

const AS_OF = "2026-11-07";
/** C018 from the bundled snapshot: tier B, 30, card at 74.7% of a $5,000 limit, RAV4 loan since Jul 2024. */
const C018: CreditInputs = { tier: "B", age: 30, utilizationPct: 74.7, missed12m: 0, accounts: 4, contractStart: "2024-07-07", asOf: AS_OF };
/** C003: tier A, 34, card at 78.8%, Corolla Cross lease since Feb 2024. */
const C003: CreditInputs = { tier: "A", age: 34, utilizationPct: 78.8, missed12m: 0, accounts: 4, contractStart: "2024-02-07", asOf: AS_OF };

const byId = (i: CreditInputs) => Object.fromEntries(creditFactors(i).map((f) => [f.id, f]));

describe("monthsBetween", () => {
  test("counts whole months, not partial ones", () => {
    expect(monthsBetween("2024-07-07", "2026-11-07")).toBe(28);
    expect(monthsBetween("2024-07-08", "2026-11-07")).toBe(27);
    expect(monthsBetween("2026-11-07", "2026-11-07")).toBe(0);
    expect(monthsBetween("2026-12-07", "2026-11-07")).toBe(-1);
  });
});

describe("estimated factors", () => {
  test("derogatory marks come from the Toyota tier", () => {
    expect(estimateDerogatoryMarks("A")).toBe(0);
    expect(estimateDerogatoryMarks("B")).toBe(0);
    expect(estimateDerogatoryMarks("C")).toBe(0);
    expect(estimateDerogatoryMarks("D")).toBe(1);
    expect(estimateDerogatoryMarks("?")).toBe(0);
  });
  test("credit age assumes credit starts at 18, never shorter than the Toyota contract", () => {
    expect(estimateCreditAgeYears({ age: 30, contractStart: "2024-07-07", asOf: AS_OF })).toBe(12);
    expect(estimateCreditAgeYears({ age: 19, contractStart: "2022-11-07", asOf: AS_OF })).toBe(4);
    expect(estimateCreditAgeYears({ age: 17, asOf: AS_OF })).toBe(0);
  });
  test("hard inquiries: tier baseline plus one for a Toyota contract opened in the last 24 months", () => {
    expect(estimateHardInquiries({ tier: "B", contractStart: "2024-07-07", asOf: AS_OF })).toBe(1);
    expect(estimateHardInquiries({ tier: "A", contractStart: "2024-02-07", asOf: AS_OF })).toBe(0);
    expect(estimateHardInquiries({ tier: "A", contractStart: "2025-06-01", asOf: AS_OF })).toBe(1);
    expect(estimateHardInquiries({ tier: "D", asOf: AS_OF })).toBe(3);
  });
});

describe("creditFactors", () => {
  test("returns all six factors in display order", () => {
    expect(creditFactors(C018).map((f) => f.name)).toEqual([
      "Credit card use", "Payment history", "Derogatory marks", "Credit age", "Total accounts", "Hard inquiries",
    ]);
  });
  test("only derogatory marks, credit age and hard inquiries are estimates", () => {
    const est = creditFactors(C018).filter((f) => f.estimated).map((f) => f.id);
    expect(est).toEqual(["derogatory", "credit_age", "inquiries"]);
  });
  test("C018 values", () => {
    const f = byId(C018);
    expect(f.card_use).toMatchObject({ value: "75%", rating: "Needs work", impact: "High impact" });
    expect(f.payment_history).toMatchObject({ value: "100% on time", rating: "Excellent", impact: "High impact" });
    expect(f.derogatory).toMatchObject({ value: "0", rating: "Excellent", impact: "High impact" });
    expect(f.credit_age).toMatchObject({ value: "About 12 yrs", rating: "Excellent", impact: "Medium" });
    expect(f.total_accounts).toMatchObject({ value: "4", rating: "Needs work", impact: "Low" });
    expect(f.inquiries).toMatchObject({ value: "1", rating: "Good", impact: "Low" });
  });
  test("C003 values", () => {
    const f = byId(C003);
    expect(f.card_use.value).toBe("79%");
    expect(f.credit_age.value).toBe("About 16 yrs");
    expect(f.inquiries).toMatchObject({ value: "0", rating: "Excellent" });
  });
  test("missed payments lower payment history", () => {
    const f = byId({ ...C018, missed12m: 1 });
    expect(f.payment_history).toMatchObject({ value: "92% on time", rating: "Fair" });
    expect(byId({ ...C018, missed12m: 3 }).payment_history.rating).toBe("Needs work");
  });
  test("card use bands", () => {
    expect(byId({ ...C018, utilizationPct: 5 }).card_use.rating).toBe("Excellent");
    expect(byId({ ...C018, utilizationPct: 25 }).card_use.rating).toBe("Good");
    expect(byId({ ...C018, utilizationPct: 45 }).card_use.rating).toBe("Fair");
  });
});

const C018_CARD = { cardBalance: 373_526, cardLimit: 500_000, autopay: true };

describe("creditSteps", () => {
  test("high card use: pay under 30% first, then under 10%, with estimated points", () => {
    const steps = creditSteps({ ...C018, ...C018_CARD });
    const [first, second] = steps;
    expect(first.id).toBe("use_30");
    expect(first.amount).toBe(373_526 - 149_999);
    const current = estimateCreditScore({ tier: "B", utilizationPct: 74.7, missed12m: 0 }).score;
    const at30 = estimateCreditScore({ tier: "B", utilizationPct: (149_999 / 500_000) * 100, missed12m: 0 }).score;
    expect(first.points).toBe(at30 - current);
    expect(second.id).toBe("use_10");
    expect(second.amount).toBe(373_526 - 49_999);
    expect(second.points).toBeGreaterThan(first.points ?? 0);
  });
  test("steps with points come first; advice steps follow", () => {
    const steps = creditSteps({ ...C018, ...C018_CARD });
    const firstAdvice = steps.findIndex((s) => s.points === null);
    expect(steps.slice(firstAdvice).every((s) => s.points === null)).toBe(true);
    expect(steps.map((s) => s.id)).toContain("no_new_credit");
    expect(steps.map((s) => s.id)).toContain("keep_old_open");
  });
  test("low card use and clean history: no paydown steps", () => {
    const steps = creditSteps({ ...C018, utilizationPct: 5, cardBalance: 20_000, cardLimit: 500_000, autopay: true });
    expect(steps.some((s) => s.id.startsWith("use_"))).toBe(false);
  });
  test("missed payments and autopay off add steps", () => {
    const ids = creditSteps({ ...C018, missed12m: 2, ...C018_CARD, autopay: false }).map((s) => s.id);
    expect(ids).toContain("on_time_12m");
    expect(ids).toContain("autopay");
  });
  test("estimated derogatory marks suggest checking the reports", () => {
    const ids = creditSteps({ ...C018, tier: "D", ...C018_CARD }).map((s) => s.id);
    expect(ids).toContain("check_reports");
  });
});

describe("creditGoalPlan", () => {
  const base = { asOf: AS_OF, tier: "B", utilizationPct: 74.7, missed12m: 0, cardBalance: 373_526, cardLimit: 500_000 };
  const current = estimateCreditScore({ tier: "B", utilizationPct: 74.7, missed12m: 0 }).score;

  test("already met", () => {
    const p = creditGoalPlan({ ...base, goal: { target: current, deadline: "2027-05-07" } });
    expect(p.status).toBe("met");
    expect(p.paydown).toBe(0);
  });
  test("reachable: smallest card paydown that hits the target, spread over the months left", () => {
    const p = creditGoalPlan({ ...base, goal: { target: 700, deadline: "2027-05-07" } });
    expect(p.status).toBe("plan");
    expect(p.months).toBe(6);
    const after = estimateCreditScore({ tier: "B", utilizationPct: ((373_526 - p.paydown) / 500_000) * 100, missed12m: 0 }).score;
    expect(after).toBeGreaterThanOrEqual(700);
    const lessPaydown = estimateCreditScore({ tier: "B", utilizationPct: ((373_526 - p.paydown + 50_000) / 500_000) * 100, missed12m: 0 }).score;
    expect(lessPaydown).toBeLessThan(700);
    expect(p.monthly).toBe(Math.ceil(p.paydown / 6));
  });
  test("out of reach: the estimate tops out for the tier", () => {
    const p = creditGoalPlan({ ...base, goal: { target: 800, deadline: "2027-11-07" } });
    expect(p.status).toBe("out_of_reach");
    expect(p.maxScore).toBe(estimateCreditScore({ tier: "B", utilizationPct: 0, missed12m: 0 }).score);
  });
  test("missed payments only age out when the deadline is 12+ months away", () => {
    const missed = { ...base, missed12m: 1, utilizationPct: 5, cardBalance: 25_000 };
    const now = estimateCreditScore({ tier: "B", utilizationPct: 5, missed12m: 1 }).score;
    const soon = creditGoalPlan({ ...missed, goal: { target: now + 20, deadline: "2027-03-07" } });
    expect(soon.status).toBe("out_of_reach");
    const later = creditGoalPlan({ ...missed, goal: { target: now + 20, deadline: "2027-12-07" } });
    expect(later.status).toBe("plan");
    expect(later.needsCleanHistory).toBe(true);
  });
  test("past deadline", () => {
    expect(creditGoalPlan({ ...base, goal: { target: 700, deadline: "2026-10-01" } }).status).toBe("past_deadline");
  });
});

describe("parseCreditGoal", () => {
  test("accepts a valid stored goal", () => {
    expect(parseCreditGoal(JSON.stringify({ target: 720, deadline: "2027-06-01" }))).toEqual({ target: 720, deadline: "2027-06-01" });
  });
  test("rejects junk, out-of-range scores and bad dates", () => {
    expect(parseCreditGoal(null)).toBeNull();
    expect(parseCreditGoal("not json")).toBeNull();
    expect(parseCreditGoal(JSON.stringify({ target: 900, deadline: "2027-06-01" }))).toBeNull();
    expect(parseCreditGoal(JSON.stringify({ target: 720, deadline: "June" }))).toBeNull();
  });
});
