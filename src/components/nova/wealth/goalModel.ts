import { AS_OF } from "@/lib/engine/types";
import { addMonths, monthsToTarget } from "@/lib/bank/view";
import type { Goal } from "@/lib/bank/goals";
import { fmtMonth } from "@/components/nova/ui";
import type { Cents } from "@/lib/money";

export const EMERGENCY_ID = "emergency";

/** A goal card: a stored envelope, or the derived emergency fund (real savings vs 6 months of essentials). */
export interface GoalCardModel { id: string; name: string; saved: Cents; target: Cents; monthly: Cents; builtIn: boolean; history: Goal["history"]; deadline?: string }

export function emergencyGoal(fund: Cents, target: Cents): GoalCardModel {
  return { id: EMERGENCY_ID, name: "Emergency fund", saved: fund, target, monthly: 0, builtIn: true, history: [] };
}

export const pct = (g: GoalCardModel) => (g.target > 0 ? Math.min(100, (g.saved / g.target) * 100) : 0);

export function paceText(g: GoalCardModel): string {
  const m = monthsToTarget(g.saved, g.target, g.monthly);
  if (m === 0) return "Goal reached";
  if (!Number.isFinite(m)) return g.builtIn ? "Target: 6 months of essentials" : "Set a monthly amount to see a date";
  const pace = `on pace for ${fmtMonth(addMonths(AS_OF, m))}`;
  return g.deadline ? `${pace} · goal date ${fmtMonth(g.deadline)}` : pace;
}
