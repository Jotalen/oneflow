import { guardrails } from "@/lib/engine/guardrails";
import type { Profile } from "@/lib/engine/types";

export type TileId = "human" | "car" | "moves" | "health" | "cards" | "accounts" | "cd" | "subscriptions" | "guard" | "fraud";
export type Requires = "always" | "human" | "car" | "card" | "cd" | "subscriptions";
export type Urgency = "none" | "handoff" | "car" | "utilization";
export interface TileDef { id: TileId; requires: Requires; urgency: Urgency }

export const LEASE_END_URGENT_MONTHS = 6;
export const PAYOFF_SOON_MONTHS = 6;
export const HIGH_UTILIZATION_PCT = 50;
const SCORE = { handoff: 100, leaseEnd: 90, recall: 85, highUtil: 70, payoffSoon: 60, carDefault: 40, base: 0 };

function visible(p: Profile, r: Requires): boolean {
  switch (r) {
    case "always": return true;
    case "human": return guardrails(p).humanHandoff;
    case "car": return !!p.car && !!p.contract;
    case "card": return p.accounts.some((a) => a.kind === "card");
    case "cd": return p.accounts.some((a) => a.kind === "cd");
    case "subscriptions": return p.bills.some((b) => b.isSubscription && b.status === "recurring");
  }
}

function urgency(p: Profile, u: Urgency): number {
  switch (u) {
    case "none": return SCORE.base;
    case "handoff": return SCORE.handoff;
    case "car": {
      const c = p.contract!;
      if (c.type === "lease" && c.monthsRemaining <= LEASE_END_URGENT_MONTHS) return SCORE.leaseEnd;
      if (p.car?.openRecall) return SCORE.recall;
      if (c.type === "loan" && c.monthsRemaining <= PAYOFF_SOON_MONTHS) return SCORE.payoffSoon;
      return SCORE.carDefault;
    }
    case "utilization": {
      const cards = p.accounts.filter((a) => a.kind === "card");
      const bal = cards.reduce((s, a) => s + Math.max(0, a.balance), 0);
      const lim = cards.reduce((s, a) => s + (a.creditLimit ?? 0), 0);
      return lim > 0 && (bal / lim) * 100 > HIGH_UTILIZATION_PCT ? SCORE.highUtil : SCORE.base;
    }
  }
}

/** Show a tile only if its data exists; order by what matters now, then registry order. */
export function orderTiles(p: Profile, registry: TileDef[]): TileId[] {
  return registry
    .map((t, i) => ({ t, i, score: visible(p, t.requires) ? urgency(p, t.urgency) : -1 }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.t.id);
}
