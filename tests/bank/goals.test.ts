import { describe, expect, test } from "vitest";
import { monthsUntil, monthlyForDeadline, reachDateFor, planGoal } from "@/lib/bank/goals";

const FROM = "2026-11-07";

describe("monthsUntil", () => {
  test("counts whole months between two dates", () => {
    expect(monthsUntil(FROM, "2027-05-07")).toBe(6);
    expect(monthsUntil(FROM, "2027-11-07")).toBe(12);
  });
  test("a day short of the anniversary is one month less", () => {
    expect(monthsUntil(FROM, "2027-05-06")).toBe(5);
  });
  test("same month or the past is zero or negative", () => {
    expect(monthsUntil(FROM, "2026-11-30")).toBe(0);
    expect(monthsUntil(FROM, "2026-10-07")).toBe(-1);
  });
});

describe("monthlyForDeadline", () => {
  test("splits what's left evenly across the months and rounds up to the cent", () => {
    // Arrange: $1,000 to go over 3 months
    // Act
    const r = monthlyForDeadline(100_000, 0, "2027-02-07", FROM);
    // Assert: 33,333.33 rounds up so the goal is met by the date
    expect(r).toEqual({ months: 3, monthly: 33_334 });
  });
  test("counts money already saved", () => {
    expect(monthlyForDeadline(100_000, 40_000, "2027-05-07", FROM)).toEqual({ months: 6, monthly: 10_000 });
  });
  test("already reached needs nothing a month", () => {
    expect(monthlyForDeadline(50_000, 60_000, "2027-05-07", FROM)).toEqual({ months: 6, monthly: 0 });
  });
  test("a date less than a month away cannot be planned", () => {
    expect(monthlyForDeadline(100_000, 0, "2026-11-30", FROM)).toBeNull();
  });
});

describe("reachDateFor", () => {
  test("adds the months needed at the monthly amount", () => {
    // $2,000 at $150/mo = 14 months (13.33 rounded up)
    expect(reachDateFor(200_000, 0, 15_000, FROM)).toBe("2028-01-07");
  });
  test("already reached is today", () => {
    expect(reachDateFor(10_000, 10_000, 5_000, FROM)).toBe(FROM);
  });
  test("no monthly amount never reaches", () => {
    expect(reachDateFor(10_000, 0, 0, FROM)).toBeNull();
  });
});

describe("planGoal", () => {
  test("deadline mode returns the monthly amount and when it lands", () => {
    const p = planGoal({ target: 120_000, saved: 0, mode: "deadline", deadline: "2027-11-07" }, FROM);
    expect(p).toEqual({ ok: true, monthly: 10_000, months: 12, reachDate: "2027-11-07", deadline: "2027-11-07" });
  });
  test("monthly mode returns the date it will be reached", () => {
    const p = planGoal({ target: 120_000, saved: 0, mode: "monthly", monthly: 20_000 }, FROM);
    expect(p).toEqual({ ok: true, monthly: 20_000, months: 6, reachDate: "2027-05-07" });
  });
  test("deadline mode rejects a missing or malformed date", () => {
    expect(planGoal({ target: 1_000, saved: 0, mode: "deadline" }, FROM)).toEqual({ ok: false, error: "Pick a date" });
    expect(planGoal({ target: 1_000, saved: 0, mode: "deadline", deadline: "next spring" }, FROM)).toEqual({ ok: false, error: "Pick a date" });
  });
  test("deadline mode rejects a date under a month away", () => {
    const p = planGoal({ target: 1_000, saved: 0, mode: "deadline", deadline: "2026-11-20" }, FROM);
    expect(p).toEqual({ ok: false, error: "Pick a date at least a month from now" });
  });
  test("deadline mode rejects a date more than 30 years out", () => {
    const p = planGoal({ target: 1_000, saved: 0, mode: "deadline", deadline: "2060-01-01" }, FROM);
    expect(p.ok).toBe(false);
  });
  test("monthly mode needs an amount above zero", () => {
    expect(planGoal({ target: 1_000, saved: 0, mode: "monthly", monthly: 0 }, FROM)).toEqual({ ok: false, error: "Enter a monthly amount above $0" });
  });
  test("monthly mode rejects a pace slower than 30 years", () => {
    const p = planGoal({ target: 10_000_000, saved: 0, mode: "monthly", monthly: 100 }, FROM);
    expect(p).toEqual({ ok: false, error: "At that amount it would take more than 30 years. Try a bigger monthly amount." });
  });
  test("target must be above zero", () => {
    expect(planGoal({ target: 0, saved: 0, mode: "monthly", monthly: 100 }, FROM)).toEqual({ ok: false, error: "Target must be above $0" });
  });
});
