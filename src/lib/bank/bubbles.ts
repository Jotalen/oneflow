/**
 * Variable dashboard. OneFlow picks a default set and order from each customer's own profile;
 * the person can add, remove and reorder, and their changes always win.
 */
import { z } from "zod";
import type { Analysis } from "@/lib/engine/analyze";
import { amortize } from "@/lib/engine/amortize";
import type { Cents } from "@/lib/money";
import { HOUSING_RATIO } from "./borrowing";
import type { BankView } from "./view";

export type BubbleId =
  | "day_to_day" | "net_worth" | "debt" | "safety_net" | "credit" | "rewards" | "budget_left" | "accounts"
  | "total_balance" | "car_financing" | "house" | "car_shopping" | "recent_txns" | "savings_goal" | "next_move";

/** small = 1 grid column, medium = 2, large = the full row. */
export type BubbleSize = "small" | "medium" | "large";
/** `pinned` bubbles can be moved but not removed. */
export interface BubbleDef { id: BubbleId; title: string; size: BubbleSize; description: string; href: string; pinned?: boolean }

export const BUBBLES: BubbleDef[] = [
  { id: "day_to_day", title: "Day-to-day", size: "small", description: "Your checking balance and how it moved this month", href: "/day-to-day" },
  { id: "net_worth", title: "Net worth", size: "small", description: "What you own minus what you owe, across linked accounts", href: "/net-worth" },
  { id: "debt", title: "Debt", size: "small", description: "Everything you owe on cards and loans, in one number", href: "/debt" },
  { id: "safety_net", title: "Safety net", size: "small", description: "How many months of essentials your savings cover", href: "/safety-net" },
  { id: "credit", title: "Credit score", size: "small", description: "Your estimated score and how much of your card limit you use", href: "/credit" },
  { id: "rewards", title: "Rewards", size: "small", description: "Card points you've earned and what they're worth", href: "/debt" },
  { id: "budget_left", title: "Budget left", size: "small", description: "How much of this month's budget you have left to spend", href: "/budget" },
  { id: "accounts", title: "Accounts", size: "small", description: "How many accounts you have linked", href: "/accounts" },
  { id: "total_balance", title: "Total balance", size: "large", description: "All your cash accounts together, with a one-month trend", href: "/accounts" },
  { id: "car_financing", title: "Car financing", size: "medium", description: "Your car loan or lease: balance, payments left, next payment", href: "/car" },
  { id: "house", title: "House financing", size: "medium", description: "A rough idea of the monthly payment and home price your income supports", href: "/house" },
  { id: "car_shopping", title: "Shopping for a car?", size: "medium", description: "A ballpark monthly payment for your next car at your credit level", href: "/car?tab=shop" },
  { id: "recent_txns", title: "Recent transactions", size: "large", description: "Your latest purchases and deposits", href: "/transactions" },
  { id: "savings_goal", title: "Savings goal", size: "medium", description: "Progress on the goal you're closest to finishing, or a way to start one", href: "/goals" },
  { id: "next_move", title: "Next best move", size: "large", description: "The one money move OneFlow thinks helps you most right now", href: "/", pinned: true },
];
const BUBBLE_IDS = BUBBLES.map((b) => b.id);
const PINNED = BUBBLES.filter((b) => b.pinned).map((b) => b.id);
export const bubbleDef = (id: BubbleId): BubbleDef => BUBBLES.find((b) => b.id === id)!;

const LOW_SAFETY_MONTHS = 1;
const THIN_SAFETY_MONTHS = 3;
const CREDIT_WATCH_UTIL = 30;
const HIGH_CARD_USE_UTIL = 70;
const CREDIT_WATCH_SCORE = 670;
const CREDIT_RISK_SCORE = 600;
const REWARDS_MIN_POINTS = 2_000;
const REWARDS_RICH_POINTS = 8_000;
const SHOP_LEASE_MONTHS = 6;
const SHOP_LOAN_PAID_PCT = 90;

/** Default slot when nothing in the profile pushes a bubble up (lower shows first). */
const BASE_RANK: Record<BubbleId, number> = {
  day_to_day: 10, safety_net: 20, debt: 30, credit: 40, net_worth: 50, total_balance: 60, car_financing: 70,
  car_shopping: 80, budget_left: 85, rewards: 90, recent_txns: 95, accounts: 97, house: 98, savings_goal: 75, next_move: 1_000,
};

export interface RecommendCtx { hasGoal: boolean }

interface Signals {
  leaseEnding: boolean; loanNearlyPaid: boolean; noCar: boolean; carMoveOnTop: boolean; extraCare: boolean;
  safetyMonths: number; heavyCardUse: boolean; creditRisk: boolean; overBudget: boolean; richRewards: boolean;
}

function signalsFor(a: Analysis, v: BankView): Signals {
  const p = a.profile;
  const c = p.contract;
  return {
    leaseEnding: c?.type === "lease" && c.monthsRemaining <= SHOP_LEASE_MONTHS,
    loanNearlyPaid: c?.type === "loan" && (v.loan?.pctPaid ?? 0) >= SHOP_LOAN_PAID_PCT,
    noCar: !c,
    carMoveOnTop: (a.ranked[0]?.id ?? "").startsWith("car:"),
    extraCare: p.flags.vulnerable || !p.flags.marketingConsent,
    safetyMonths: v.safetyNet.months,
    heavyCardUse: v.credit.utilizationPct > HIGH_CARD_USE_UTIL || a.ranked[0]?.id === "pay_highest_apr",
    creditRisk: v.credit.score < CREDIT_RISK_SCORE || p.flags.missed12m > 0,
    overBudget: v.budget.categories.some((x) => !x.fixed && x.spent > x.limit),
    richRewards: v.rewards.points >= REWARDS_RICH_POINTS,
  };
}

/** Which bubbles this customer gets by default. */
function included(a: Analysis, v: BankView, s: Signals, ctx: RecommendCtx): Set<BubbleId> {
  const p = a.profile;
  const c = p.contract;
  const shopping = s.leaseEnding || (!s.extraCare && (s.noCar || s.loanNearlyPaid));
  const want: [BubbleId, boolean][] = [
    ["day_to_day", true],
    ["net_worth", p.accounts.length + (c ? 1 : 0) >= 2],
    ["debt", v.totalDebt > 0],
    ["safety_net", true],
    ["credit", v.credit.utilizationPct > CREDIT_WATCH_UTIL || v.credit.score < CREDIT_WATCH_SCORE],
    ["rewards", v.rewards.points >= REWARDS_MIN_POINTS],
    ["budget_left", s.overBudget],
    ["total_balance", p.accounts.filter((x) => x.kind !== "card").length >= 2],
    ["car_financing", !!c],
    ["car_shopping", shopping],
    ["recent_txns", true],
    ["savings_goal", ctx.hasGoal],
    ["next_move", true],
  ];
  return new Set(want.filter(([, on]) => on).map(([id]) => id));
}

/** Profile signals that move a bubble up. Each returns a rank that replaces the base if lower. */
function boosts(s: Signals): Partial<Record<BubbleId, number>> {
  const out: Partial<Record<BubbleId, number>> = {};
  const lift = (id: BubbleId, rank: number) => { out[id] = Math.min(out[id] ?? Infinity, rank); };
  if (s.safetyMonths < LOW_SAFETY_MONTHS) lift("safety_net", 0);
  if (s.leaseEnding) { lift("car_financing", 1); lift("car_shopping", 2); }
  if (s.loanNearlyPaid) { lift("car_shopping", 5); lift("car_financing", 6); }
  if (s.carMoveOnTop) lift("car_financing", 12);
  if (s.noCar) lift("car_shopping", 45);
  if (s.safetyMonths < THIN_SAFETY_MONTHS || s.extraCare) lift("safety_net", 3);
  if (s.creditRisk) { lift("credit", 6); lift("debt", 7); }
  if (s.heavyCardUse) { lift("debt", 7); lift("credit", 8); }
  if (s.overBudget) lift("budget_left", 9);
  lift("savings_goal", 15);
  if (s.richRewards) lift("rewards", 35);
  return out;
}

/** OneFlow's default dashboard for this customer: which bubbles, in what order. Next best move goes last. */
export function recommendBubbles(a: Analysis, v: BankView, ctx: RecommendCtx): BubbleId[] {
  const s = signalsFor(a, v);
  const on = included(a, v, s, ctx);
  const lifted = boosts(s);
  const rank = (id: BubbleId) => Math.min(BASE_RANK[id], lifted[id] ?? Infinity);
  return BUBBLE_IDS.filter((id) => on.has(id)).sort((x, y) => rank(x) - rank(y) || BASE_RANK[x] - BASE_RANK[y]);
}

export interface DashboardPrefs { auto: boolean; order: BubbleId[] | null; removed: BubbleId[]; added: BubbleId[] }
export const DEFAULT_PREFS: DashboardPrefs = { auto: true, order: null, removed: [], added: [] };

const uniq = <T,>(xs: T[]): T[] => xs.filter((x, i) => xs.indexOf(x) === i);
const withPinned = (ids: BubbleId[]): BubbleId[] => [...ids, ...PINNED.filter((id) => !ids.includes(id))];

/** Merge OneFlow's picks with the person's edits. Their changes always win; pinned bubbles always show. */
export function applyPrefs(recommended: BubbleId[], prefs: DashboardPrefs): BubbleId[] {
  const removed = new Set(prefs.removed.filter((id) => !PINNED.includes(id)));
  if (!prefs.auto && prefs.order) return withPinned(uniq(prefs.order).filter((id) => !removed.has(id)));
  const base = uniq([...recommended, ...prefs.added]).filter((id) => !removed.has(id));
  if (!prefs.order) return withPinned(base);
  const ordered = uniq(prefs.order).filter((id) => base.includes(id));
  return withPinned([...ordered, ...base.filter((id) => !ordered.includes(id))]);
}

/* Edit operations. Each takes the prefs and the list currently shown, and returns new prefs. */

export function removeBubble(prefs: DashboardPrefs, current: BubbleId[], id: BubbleId): DashboardPrefs {
  if (PINNED.includes(id)) return prefs;
  return { ...prefs, order: current.filter((x) => x !== id), removed: uniq([...prefs.removed, id]), added: prefs.added.filter((x) => x !== id) };
}

export function addBubble(prefs: DashboardPrefs, current: BubbleId[], recommended: BubbleId[], id: BubbleId): DashboardPrefs {
  return {
    ...prefs,
    order: uniq([...current, id]),
    removed: prefs.removed.filter((x) => x !== id),
    added: recommended.includes(id) ? prefs.added : uniq([...prefs.added, id]),
  };
}

export function moveBubble(prefs: DashboardPrefs, current: BubbleId[], id: BubbleId, delta: number): DashboardPrefs {
  const i = current.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= current.length) return prefs;
  const next = current.filter((x) => x !== id);
  return { ...prefs, order: [...next.slice(0, j), id, ...next.slice(j)] };
}

export function dropBubble(prefs: DashboardPrefs, current: BubbleId[], dragged: BubbleId, target: BubbleId): DashboardPrefs {
  if (dragged === target || !current.includes(dragged)) return prefs;
  const next = current.filter((x) => x !== dragged);
  const at = next.indexOf(target);
  if (at < 0) return prefs;
  return { ...prefs, order: [...next.slice(0, at), dragged, ...next.slice(at)] };
}

/** Turning auto-pick off freezes what is shown now, so nothing jumps. */
export function setAutoPick(prefs: DashboardPrefs, current: BubbleId[], auto: boolean): DashboardPrefs {
  return { ...prefs, auto, order: prefs.order ?? current };
}

/** Car financing describes a real contract, so it needs one. Everything else works for anyone. */
export function canAddBubble(id: BubbleId, ctx: { hasContract: boolean }): boolean {
  return id !== "car_financing" || ctx.hasContract;
}

const idList = z.array(z.string()).transform((xs) => xs.filter((x): x is BubbleId => (BUBBLE_IDS as string[]).includes(x)));
const prefsSchema = z.object({
  auto: z.boolean().catch(DEFAULT_PREFS.auto),
  order: idList.nullable().catch(null),
  removed: idList.catch([]),
  added: idList.catch([]),
}).partial();

/** Stored prefs → DashboardPrefs. Corrupt JSON or ids from an older version never break the Overview. */
export function parseDashboardPrefs(raw: string | null): DashboardPrefs {
  if (!raw) return DEFAULT_PREFS;
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return DEFAULT_PREFS; }
  const parsed = prefsSchema.safeParse(json);
  return parsed.success ? { ...DEFAULT_PREFS, ...parsed.data } : DEFAULT_PREFS;
}

/* House financing bubble: the same assumptions as the /house calculator's starting values. */
const HOUSE_APR = 6.5;
const HOUSE_TERM_MONTHS = 360;
const HOUSE_DOWN_PCT = 10;

export interface HouseSummary { ratioPct: number; limit: Cents; price: Cents; monthlyAtPrice: Cents; aprPct: number; downPct: number; termYears: number }

/** Housing payment guideline (28% of income) and the home price that payment roughly buys. Principal and interest only. */
export function houseSummary(incomeMonthly: Cents): HouseSummary {
  const limit = Math.round(incomeMonthly * HOUSING_RATIO);
  const r = HOUSE_APR / 100 / 12;
  const maxLoan = limit > 0 ? (limit * (1 - Math.pow(1 + r, -HOUSE_TERM_MONTHS))) / r : 0;
  const rawPrice = maxLoan / (1 - HOUSE_DOWN_PCT / 100);
  const price = Math.floor(rawPrice / 100_000) * 100_000; // round down to the nearest $1,000
  const monthlyAtPrice = price > 0 ? amortize(Math.round(price * (1 - HOUSE_DOWN_PCT / 100)), HOUSE_APR, HOUSE_TERM_MONTHS) : 0;
  return { ratioPct: Math.round(HOUSING_RATIO * 100), limit, price, monthlyAtPrice, aprPct: HOUSE_APR, downPct: HOUSE_DOWN_PCT, termYears: HOUSE_TERM_MONTHS / 12 };
}
