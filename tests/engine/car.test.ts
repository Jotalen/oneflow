import { describe, expect, test } from "vitest";
import { carMoves } from "@/lib/engine/moves/car";
import { profileFor, toyota } from "../fixtures/profiles";

describe("carMoves", () => {
  test("C003 includes BUYOUT and excludes eligibility N options and KEEP", () => {
    const ids = carMoves(profileFor("C003"), toyota).map((m) => m.tfs!.optionId);
    expect(ids).toContain("BUYOUT");
    expect(ids).not.toContain("KEEP");
    const nIds = toyota.options.filter((o) => o.customer_id === "C003" && /^N/i.test(o.eligibility)).map((o) => o.option_id);
    for (const n of nIds) expect(ids).not.toContain(n);
  });

  test("C014 returns exactly one move with kind human", () => {
    const moves = carMoves(profileFor("C014"), toyota);
    expect(moves).toHaveLength(1);
    expect(moves[0].kind).toBe("human");
    expect(moves[0].tfs?.nextStepType).toMatch(/follow-up/i);
  });

  test("C011 excludes TRADE and RENEW (consent N) and routes to human", () => {
    const moves = carMoves(profileFor("C011"), toyota);
    const ids = moves.map((m) => m.tfs?.optionId);
    expect(ids).not.toContain("TRADE");
    expect(ids).not.toContain("RENEW");
    expect(moves.some((m) => m.kind === "human")).toBe(true);
  });

  test("Review eligibility is kept as a follow-up (C010 RELOCATE)", () => {
    const m = carMoves(profileFor("C010"), toyota).find((x) => x.tfs?.optionId === "RELOCATE");
    expect(m).toBeDefined();
    expect(m!.tfs!.nextStepType).toMatch(/follow-up/i);
  });

  test("Caution eligibility is excluded (C001 TRADE)", () => {
    const ids = carMoves(profileFor("C001"), toyota).map((m) => m.tfs!.optionId);
    expect(ids).not.toContain("TRADE");
    expect(ids).toContain("REFI");
  });

  test("every car move carries the TFS plain summary and total cost", () => {
    for (const m of carMoves(profileFor("C003"), toyota)) {
      expect(m.tfs!.plainSummary.length).toBeGreaterThan(10);
      expect(m.tfs!.tfsTotalVsKeep === null || typeof m.tfs!.tfsTotalVsKeep === "number").toBe(true);
    }
  });
});

describe("review fixes — car moves", () => {
  test("TRADE never carries a positive fixed impact (equity is already in net worth)", () => {
    for (const id of ["C004", "C005", "C007", "C015", "C018", "C020"]) {
      const trade = carMoves(profileFor(id), toyota).find((m) => m.tfs?.optionId === "TRADE");
      if (trade) expect(trade.fixedImpact24 ?? 0).toBeLessThanOrEqual(0);
    }
  });
  test("EXTRA100 targets the vehicle contract, not the card", () => {
    const m = carMoves(profileFor("C001"), toyota).find((x) => x.tfs?.optionId === "EXTRA100")!;
    expect(m.overrides.extraToDebtTargetId).toBe("contract");
  });
});
