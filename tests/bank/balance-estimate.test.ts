import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { Analysis } from "@/lib/engine/analyze";
import { AS_OF } from "@/lib/engine/types";
import { WINDOW_DAYS, addDays, buildLedger } from "@/lib/bank/view";
import {
  RANGE_DAYS, balanceSeries, checkingHistory, estimateBefore, occursOn, paydaysFor, recurringFlows, type RecurringFlows,
} from "@/lib/bank/balanceEstimate";

const snap = (id: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/snapshots", `${id}.json`), "utf8")) as Analysis;
const NONE: RecurringFlows = { paycheck: 0, paydays: [], bills: [], dailyOut: 0 };

describe("occursOn", () => {
  test("a day past the end of the month lands on the last day", () => {
    expect(occursOn(31, "2026-09-30")).toBe(true);
    expect(occursOn(30, "2027-02-28")).toBe(true);
    expect(occursOn(30, "2027-02-27")).toBe(false);
    expect(occursOn(15, "2026-10-15")).toBe(true);
  });
});

describe("paydaysFor", () => {
  test("twice a month, 15 days apart", () => {
    expect(paydaysFor(15)).toEqual([15, 30]);
    expect(paydaysFor(30)).toEqual([15, 30]);
    expect(paydaysFor(1)).toEqual([1, 16]);
  });
});

describe("estimateBefore", () => {
  const anchor = { date: "2026-09-16", value: 100_000 };
  test("returns `days` points before the anchor, oldest first, all dated", () => {
    const out = estimateBefore(anchor, 3, NONE);
    expect(out.map((p) => p.date)).toEqual(["2026-09-13", "2026-09-14", "2026-09-15"]);
    expect(out.every((p) => p.value === 100_000)).toBe(true);
  });
  test("undoing a paycheck lowers the balance before payday", () => {
    const out = estimateBefore(anchor, 2, { ...NONE, paycheck: 50_000, paydays: [15] });
    expect(out).toEqual([{ date: "2026-09-14", value: 50_000 }, { date: "2026-09-15", value: 100_000 }]);
  });
  test("undoing a bill and daily spending raises the balance before", () => {
    const out = estimateBefore({ date: "2026-10-02", value: 10_000 }, 2, { ...NONE, bills: [{ amount: 5_000, dueDay: 1 }], dailyOut: 1_000 });
    // 10-02 end: 10,000 → 10-01 end: +1,000 spend undone = 11,000 → 09-30 end: +5,000 bill +1,000 spend = 17,000
    expect(out).toEqual([{ date: "2026-09-30", value: 17_000 }, { date: "2026-10-01", value: 11_000 }]);
  });
  test("never estimates a negative balance", () => {
    const out = estimateBefore({ date: "2026-09-16", value: 1_000 }, 5, { ...NONE, paycheck: 50_000, paydays: [15] });
    expect(Math.min(...out.map((p) => p.value))).toBe(0);
  });
  test("zero days gives no points", () => {
    expect(estimateBefore(anchor, 0, NONE)).toEqual([]);
  });
});

describe("recurringFlows", () => {
  const a = snap("C001");
  const ledger = buildLedger(a.profile);
  const flows = recurringFlows(a.profile, ledger);
  test("paycheck is half the monthly income on the two paydays", () => {
    expect(flows.paycheck).toBe(Math.round(a.profile.incomeMonthly / 2));
    expect(flows.paydays).toEqual(paydaysFor(a.profile.paydayDay));
  });
  test("bills are the recurring bills plus the car payment, each once", () => {
    const recurring = a.profile.bills.filter((b) => b.status === "recurring" && !b.isVehiclePayment).reduce((s, b) => s + b.amount, 0);
    expect(flows.bills.reduce((s, b) => s + b.amount, 0)).toBe(recurring + a.profile.contract!.monthlyPayment);
  });
  test("daily outflow is at least what the real checking ledger shows", () => {
    const realOut = ledger.filter((t) => t.accountKind === "checking" && t.amount < 0).reduce((s, t) => s - t.amount, 0);
    expect(flows.dailyOut).toBeGreaterThanOrEqual(Math.floor(realOut / WINDOW_DAYS));
  });
  test("an estimated month nets to zero or less, so estimates never trend into the negative", () => {
    const monthIn = flows.paycheck * flows.paydays.length;
    const monthOut = flows.bills.reduce((s, b) => s + b.amount, 0) + flows.dailyOut * (365 / 12);
    expect(monthIn - monthOut).toBeLessThanOrEqual(flows.paycheck * 0.05);
  });
});

describe("checkingHistory", () => {
  test("ends at today's checking balance, one point per day", () => {
    const a = snap("C003");
    const h = checkingHistory(a.profile, buildLedger(a.profile), 30);
    expect(h).toHaveLength(31);
    const checking = a.profile.accounts.filter((x) => x.kind === "checking").reduce((s, x) => s + x.balance, 0);
    expect(h[h.length - 1]).toEqual({ date: AS_OF, value: checking });
  });
});

describe("balanceSeries", () => {
  const a = snap("C001");
  const ledger = buildLedger(a.profile);
  test("1M is all real data", () => {
    const s = balanceSeries(a.profile, ledger, "1M");
    expect(s.points).toHaveLength(RANGE_DAYS["1M"] + 1);
    expect(s.points.every((p) => p.real !== undefined && p.estimated === undefined)).toBe(true);
    expect(s.estimatedUntil).toBeNull();
  });
  test.each(["3M", "6M"] as const)("%s: real for the last 8 weeks, estimated before, joined at one shared point", (range) => {
    const s = balanceSeries(a.profile, ledger, range);
    expect(s.points).toHaveLength(RANGE_DAYS[range] + 1);
    const boundary = addDays(AS_OF, -WINDOW_DAYS);
    expect(s.estimatedUntil).toBe(boundary);
    const shared = s.points.filter((p) => p.real !== undefined && p.estimated !== undefined);
    expect(shared).toHaveLength(1);
    expect(shared[0].date).toBe(boundary);
    expect(shared[0].real).toBe(shared[0].estimated);
    for (const p of s.points) {
      if (p.date < boundary) expect(p.real).toBeUndefined();
      if (p.date > boundary) expect(p.estimated).toBeUndefined();
    }
    expect(s.points[s.points.length - 1]).toMatchObject({ date: AS_OF, real: a.profile.accounts.find((x) => x.kind === "checking")!.balance });
  });
  test.each(["C001", "C003", "C007", "C012", "C018"])("%s 6M estimates are whole, non-negative cents", (id) => {
    const p = snap(id).profile;
    const s = balanceSeries(p, buildLedger(p), "6M");
    for (const pt of s.points) {
      if (pt.real !== undefined) expect(Number.isInteger(pt.real)).toBe(true);
      if (pt.estimated !== undefined) { expect(Number.isInteger(pt.estimated)).toBe(true); expect(pt.estimated).toBeGreaterThanOrEqual(0); }
    }
  });
});
