import { describe, expect, test } from "vitest";
import { buildBalanceSeries } from "@/lib/tiger/history";

const accounts = [
  { id: "chk", kind: "checking" },
  { id: "sav", kind: "savings" },
  { id: "card", kind: "card" },
];

describe("buildBalanceSeries", () => {
  test("sums cash accounts per bucket and carries the last known balance forward", () => {
    const rows = [
      { bucket: "2026-11-08T00:15:00Z", accountId: "chk", balanceCents: 1_000 },
      { bucket: "2026-11-08T00:15:00Z", accountId: "sav", balanceCents: 5_000 },
      { bucket: "2026-11-08T00:30:00Z", accountId: "chk", balanceCents: 800 },
      { bucket: "2026-11-08T00:45:00Z", accountId: "card", balanceCents: 300 },
    ];
    expect(buildBalanceSeries(rows, accounts)).toEqual([
      { t: "2026-11-08T00:15:00Z", cash: 6_000, cardOwed: 0 },
      { t: "2026-11-08T00:30:00Z", cash: 5_800, cardOwed: 0 },
      { t: "2026-11-08T00:45:00Z", cash: 5_800, cardOwed: 300 },
    ]);
  });

  test("ignores accounts that are not this persona's", () => {
    expect(buildBalanceSeries([{ bucket: "2026-11-08T00:15:00Z", accountId: "other", balanceCents: 9 }], accounts)).toEqual([]);
  });
});
