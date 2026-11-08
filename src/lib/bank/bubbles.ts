/**
 * Variable dashboard. Each bubble has a rule for when NovaBank adds it (wireframe "Bubble library");
 * the person can add, remove and reorder, and their changes always win.
 */
import type { Analysis } from "@/lib/engine/analyze";
import type { BankView } from "./view";

export type BubbleId =
  | "day_to_day" | "net_worth" | "debt" | "safety_net" | "credit" | "rewards" | "budget_left" | "accounts"
  | "total_balance" | "car_financing" | "house" | "car_shopping" | "recent_txns" | "savings_goal";

export type BubbleSize = "small" | "medium" | "large";
export interface BubbleDef { id: BubbleId; title: string; size: BubbleSize; rule: string; href: string }

export const BUBBLES: BubbleDef[] = [
  { id: "day_to_day", title: "Day-to-day", size: "small", rule: "Always", href: "/day-to-day" },
  { id: "net_worth", title: "Net worth", size: "small", rule: "2+ accounts are linked", href: "/net-worth" },
  { id: "debt", title: "Debt", size: "small", rule: "Any loan or card balance is linked", href: "/debt" },
  { id: "safety_net", title: "Safety net", size: "small", rule: "Always, raised to the top if under 1 month", href: "/safety-net" },
  { id: "credit", title: "Credit score", size: "small", rule: "Card use over 30% or score under 670", href: "/credit" },
  { id: "rewards", title: "Rewards", size: "small", rule: "Points are worth $20+ to redeem", href: "/rewards" },
  { id: "budget_left", title: "Budget left", size: "small", rule: "A budget category is over its limit", href: "/budget" },
  { id: "accounts", title: "Accounts", size: "small", rule: "Never on its own, you add it", href: "/accounts" },
  { id: "total_balance", title: "Total balance", size: "large", rule: "2+ cash accounts are linked", href: "/accounts" },
  { id: "car_financing", title: "Car financing", size: "medium", rule: "A car loan or lease is linked", href: "/car" },
  { id: "house", title: "House financing", size: "medium", rule: "A mortgage is linked", href: "/house" },
  { id: "car_shopping", title: "Shopping for a car?", size: "medium", rule: "No car loan, loan 90%+ paid, or lease ends within 6 months", href: "/car?tab=shop" },
  { id: "recent_txns", title: "Recent transactions", size: "large", rule: "Always", href: "/transactions" },
  { id: "savings_goal", title: "Savings goal", size: "medium", rule: "A goal exists; shows the closest-to-done goal", href: "/goals" },
];
export const bubbleDef = (id: BubbleId) => BUBBLES.find((b) => b.id === id)!;

const LOW_SAFETY_MONTHS = 1;
const CREDIT_WATCH_UTIL = 30;
const CREDIT_WATCH_SCORE = 670;
const REWARDS_MIN_POINTS = 2_000;
const SHOP_LEASE_MONTHS = 6;
const SHOP_LOAN_PAID_PCT = 90;

export function recommendBubbles(a: Analysis, v: BankView, ctx: { hasGoal: boolean }): BubbleId[] {
  const p = a.profile;
  const cashAccounts = p.accounts.filter((x) => x.kind !== "card").length;
  const c = p.contract;
  const want: [BubbleId, boolean][] = [
    ["day_to_day", true],
    ["net_worth", p.accounts.length + (c ? 1 : 0) >= 2],
    ["debt", v.totalDebt > 0],
    ["safety_net", true],
    ["credit", v.credit.utilizationPct > CREDIT_WATCH_UTIL || v.credit.score < CREDIT_WATCH_SCORE],
    ["rewards", v.rewards.points >= REWARDS_MIN_POINTS],
    ["budget_left", v.budget.categories.some((x) => !x.fixed && x.spent > x.limit)],
    ["total_balance", cashAccounts >= 2],
    ["car_financing", !!c],
    ["car_shopping", !c || (c.type === "lease" && c.monthsRemaining <= SHOP_LEASE_MONTHS) || (c.type === "loan" && (v.loan?.pctPaid ?? 0) >= SHOP_LOAN_PAID_PCT)],
    ["recent_txns", true],
    ["savings_goal", ctx.hasGoal],
  ];
  const ids = want.filter(([, on]) => on).map(([id]) => id);
  return v.safetyNet.months < LOW_SAFETY_MONTHS ? ["safety_net", ...ids.filter((x) => x !== "safety_net")] : ids;
}

export interface DashboardPrefs { auto: boolean; order: BubbleId[] | null; removed: BubbleId[]; added: BubbleId[] }
export const DEFAULT_PREFS: DashboardPrefs = { auto: true, order: null, removed: [], added: [] };

/** Merge NovaBank's picks with the person's edits. Their changes always win. */
export function applyPrefs(recommended: BubbleId[], prefs: DashboardPrefs): BubbleId[] {
  const removed = new Set(prefs.removed);
  if (!prefs.auto && prefs.order) return prefs.order.filter((id) => !removed.has(id));
  const base = [...recommended, ...prefs.added].filter((id, i, arr) => arr.indexOf(id) === i && !removed.has(id));
  if (!prefs.order) return base;
  const ordered = prefs.order.filter((id) => base.includes(id));
  return [...ordered, ...base.filter((id) => !ordered.includes(id))];
}
