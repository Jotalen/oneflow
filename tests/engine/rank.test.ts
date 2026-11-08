import { describe, expect, test } from "vitest";
import { carMoves } from "@/lib/engine/moves/car";
import { bankMoves } from "@/lib/engine/moves/bank";
import { rankMoves } from "@/lib/engine/moves/rank";
import type { Move } from "@/lib/engine/types";
import { profileFor, toyota } from "../fixtures/profiles";

const golden = (id: string) => toyota.golden.find((g) => g.customer_id === id)!;

describe("rankMoves", () => {
  test("C003 top car move equals golden offer and is flagged goldenMatch", () => {
    const p = profileFor("C003");
    const ranked = rankMoves(p, [...carMoves(p, toyota), ...bankMoves(p)], toyota);
    const topCar = ranked.find((m) => m.kind === "car")!;
    expect(topCar.tfs!.optionId).toBe(golden("C003").offer_id);
    expect(topCar.goldenMatch).toBe(true);
  });

  test("C001 and C008 top car move is REFI (golden)", () => {
    for (const id of ["C001", "C008"]) {
      const p = profileFor(id);
      const topCar = rankMoves(p, carMoves(p, toyota), toyota).find((m) => m.kind === "car")!;
      expect(topCar.tfs!.optionId).toBe("REFI");
      expect(topCar.goldenMatch).toBe(true);
    }
  });

  test("goldenMatch false when eligibility is not Y even if id matches", () => {
    const p = profileFor("C003");
    const fake: Move = {
      id: "car:BUYOUT", kind: "car", title: "Buy out", why: "", impactKind: "netWorth", overrides: {},
      tfs: { optionId: "BUYOUT", eligibility: "Review", tfsTotalVsKeep: -100_000, nextStepType: "Offer", plainSummary: "x", assumption: "", tradeoff: "" },
    };
    expect(rankMoves(p, [fake], toyota)[0].goldenMatch).toBe(false);
  });

  test("human move sorts first regardless of impact", () => {
    const p = profileFor("C014");
    const ranked = rankMoves(p, [...bankMoves(p), ...carMoves(p, toyota)], toyota);
    expect(ranked[0].kind).toBe("human");
  });

  test("ranked moves carry baseline and applied projections of equal length", () => {
    const p = profileFor("C003");
    const r = rankMoves(p, carMoves(p, toyota), toyota)[0];
    expect(r.baseline.points).toHaveLength(r.applied.points.length);
    expect(Number.isFinite(r.impact24)).toBe(true);
  });

  test("sorted by impact24 descending after the human move", () => {
    const p = profileFor("C003");
    const ranked = rankMoves(p, [...carMoves(p, toyota), ...bankMoves(p)], toyota).filter((m) => m.kind !== "human");
    for (let i = 1; i < ranked.length; i++) expect(ranked[i - 1].impact24).toBeGreaterThanOrEqual(ranked[i].impact24);
  });
});

describe("review fixes — ranking", () => {
  test("C005 top car move is not TRADE", () => {
    const p = profileFor("C005");
    const top = rankMoves(p, carMoves(p, toyota), toyota).find((m) => m.kind === "car");
    expect(top?.tfs?.optionId).not.toBe("TRADE");
  });
  test("C006 RENEW and BUYOUT are both positive, ordered by projected impact", () => {
    const p = profileFor("C006");
    const cars = rankMoves(p, carMoves(p, toyota), toyota).filter((m) => m.kind === "car");
    const renew = cars.find((m) => m.tfs!.optionId === "RENEW")!;
    const buyout = cars.find((m) => m.tfs!.optionId === "BUYOUT")!;
    expect(renew.impact24).toBeGreaterThan(0);
    expect(buyout.impact24).toBeGreaterThan(0);
    expect(cars.indexOf(renew)).toBeLessThanOrEqual(1);
  });
  test("C003 and C017 still rank BUYOUT first", () => {
    for (const id of ["C003", "C017"]) {
      const p = profileFor(id);
      expect(rankMoves(p, carMoves(p, toyota), toyota).find((m) => m.kind === "car")!.tfs!.optionId).toBe("BUYOUT");
    }
  });
});
