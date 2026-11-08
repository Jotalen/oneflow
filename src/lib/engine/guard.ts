import { fmtUSD, type Cents } from "@/lib/money";
import { liquidTotal } from "./cashflow";
import type { HealthReport } from "./health";
import type { Profile } from "./types";

/** Pending-transaction guard (ADR-005). Rules are the whole policy; keep them here and show them in the UI. */
export const DECLINE_SHARE_OF_LIQUID = 0.5;
export const ASK_ABOVE_CENTS: Cents = 50_000;
export const ASK_RUNWAY_BELOW_MONTHS = 1;
export const BLOCKED_CATEGORIES = new Set(["gambling", "crypto", "wire_transfer"]);
const CREDIT_KINDS = new Set(["deposit", "refund", "interest_credit"]);

export interface PendingTxn { id: string; kind: string; amountCents: Cents; description?: string | null; merchantCategory?: string | null; payeeId?: string | null }
export type GuardDecision = { decision: "approve" | "decline" | "ask"; reason: string; rule: string };

export function guardDecision(tx: PendingTxn, p: Profile, h: HealthReport): GuardDecision {
  if (CREDIT_KINDS.has(tx.kind)) return { decision: "approve", reason: "Money coming in", rule: "credit" };
  const cat = (tx.merchantCategory ?? "").toLowerCase();
  if (BLOCKED_CATEGORIES.has(cat)) return { decision: "decline", reason: `Blocked category: ${cat}`, rule: "blocked_category" };
  const liquid = liquidTotal(p);
  if (liquid > 0 && tx.amountCents > liquid * DECLINE_SHARE_OF_LIQUID) {
    return { decision: "decline", reason: `${fmtUSD(tx.amountCents)} is more than half of your liquid cash (${fmtUSD(liquid)})`, rule: "over_half_liquid" };
  }
  if (tx.amountCents > ASK_ABOVE_CENTS && h.runwayMonths < ASK_RUNWAY_BELOW_MONTHS) {
    return { decision: "ask", reason: `${fmtUSD(tx.amountCents)} with under ${ASK_RUNWAY_BELOW_MONTHS} month of runway — confirm?`, rule: "large_low_runway" };
  }
  return { decision: "approve", reason: "Within budget", rule: "within_budget" };
}
