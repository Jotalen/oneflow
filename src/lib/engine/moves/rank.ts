import type { ToyotaData } from "@/lib/toyota/types";
import { project, type Projection, type ProfileOverrides } from "../project";
import type { Move, Profile } from "../types";

export interface RankedMove extends Move {
  impact24: number;
  baseline: Projection;
  applied: Projection;
  goldenMatch: boolean;
}

const tier = (m: Move, p: Profile): number => {
  if (m.kind === "human") return 0;
  if (m.kind === "car" && m.tfs?.optionId === "SERVICE" && p.car?.openRecall) return 1; // safety first
  return 2;
};

/** impact24 = netWorth24(applied) − netWorth24(base), or the move's fixed estimate when the projection cannot express it. */
export function rankMoves(p: Profile, moves: Move[], t: ToyotaData): RankedMove[] {
  const baseline = project(p);
  const golden = t.golden.find((g) => g.customer_id === p.personaId);
  const ranked = moves.map((m) => {
    const applied = project(p, 24, m.overrides as Partial<ProfileOverrides>);
    const impact24 = m.fixedImpact24 ?? applied.netWorth24 - baseline.netWorth24;
    return { ...m, impact24, baseline, applied, goldenMatch: false };
  });
  ranked.sort((a, b) => tier(a, p) - tier(b, p) || b.impact24 - a.impact24);
  // Golden answers name a TFS offer; compare with the top-ranked move that carries one (car, human, or AUTOPAY).
  const topCar = ranked.find((m) => m.kind === "car" || m.kind === "human" || m.tfs);
  if (topCar && golden && topCar.tfs && topCar.tfs.optionId === golden.offer_id && topCar.tfs.eligibility === "Y") {
    topCar.goldenMatch = true;
  }
  return ranked;
}
