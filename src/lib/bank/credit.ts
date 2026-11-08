/**
 * Credit score factors, steps and goal plan. Pure, deterministic, integer cents.
 * Real data: card use, payment history (missed payments), total accounts.
 * Estimated (labelled "Estimate" in the UI): derogatory marks, credit age, hard inquiries,
 * from the Toyota credit tier and the customer profile. The score itself is view.ts's estimate.
 */
import type { Cents } from "@/lib/money";
import { estimateCreditScore } from "./view";
import { paymentToReachUtil } from "./wealth";

export type FactorId = "card_use" | "payment_history" | "derogatory" | "credit_age" | "total_accounts" | "inquiries";
export type FactorRating = "Excellent" | "Good" | "Fair" | "Needs work";
export type FactorImpact = "High impact" | "Medium" | "Low";

export interface CreditFactor { id: FactorId; name: string; value: string; rating: FactorRating; impact: FactorImpact; estimated: boolean; note: string }

export interface CreditInputs { tier: string; age: number; utilizationPct: number; missed12m: number; accounts: number; contractStart?: string; asOf: string }

const MONTHS_PER_YEAR = 12;
const CREDIT_START_AGE = 18;
const INQUIRY_WINDOW_MONTHS = 24;
const TIER_DEROGATORY: Record<string, number> = { A: 0, B: 0, C: 0, D: 1 };
const TIER_INQUIRIES: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
export const LOW_USE_PCT = 10;
export const OK_USE_PCT = 30;
const FAIR_USE_PCT = 50;
/** Matches estimateCreditScore's missed-payment penalty; used only to explain the step. */
const MISSED_POINTS = 30;

/** Whole months from `from` to `to` (ISO dates); negative when `to` is earlier. */
export function monthsBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return (y2 - y1) * MONTHS_PER_YEAR + (m2 - m1) - (d2 < d1 ? 1 : 0);
}

export function estimateDerogatoryMarks(tier: string): number {
  return TIER_DEROGATORY[tier] ?? 0;
}

/** Oldest account: credit usually starts around 18; never shorter than the Toyota contract we can see. */
export function estimateCreditAgeYears(i: { age: number; contractStart?: string; asOf: string }): number {
  const fromAge = Math.max(0, i.age - CREDIT_START_AGE);
  const fromContract = i.contractStart ? Math.max(0, Math.floor(monthsBetween(i.contractStart, i.asOf) / MONTHS_PER_YEAR)) : 0;
  return Math.max(fromAge, fromContract);
}

/** Tier baseline, plus one if the Toyota contract (a credit pull) opened in the last 24 months. */
export function estimateHardInquiries(i: { tier: string; contractStart?: string; asOf: string }): number {
  const recentContract = i.contractStart !== undefined && monthsBetween(i.contractStart, i.asOf) < INQUIRY_WINDOW_MONTHS ? 1 : 0;
  return (TIER_INQUIRIES[i.tier] ?? 1) + recentContract;
}

export const onTimePct = (missed12m: number): number => Math.round(((MONTHS_PER_YEAR - Math.min(MONTHS_PER_YEAR, missed12m)) / MONTHS_PER_YEAR) * 100);

const cardUseRating = (pct: number): FactorRating => (pct < LOW_USE_PCT ? "Excellent" : pct < OK_USE_PCT ? "Good" : pct < FAIR_USE_PCT ? "Fair" : "Needs work");
const missedRating = (n: number): FactorRating => (n === 0 ? "Excellent" : n === 1 ? "Fair" : "Needs work");
const derogRating = (n: number): FactorRating => (n === 0 ? "Excellent" : n === 1 ? "Fair" : "Needs work");
const ageRating = (y: number): FactorRating => (y >= 9 ? "Excellent" : y >= 7 ? "Good" : y >= 5 ? "Fair" : "Needs work");
const accountsRating = (n: number): FactorRating => (n >= 21 ? "Excellent" : n >= 11 ? "Good" : n >= 6 ? "Fair" : "Needs work");
const inquiryRating = (n: number): FactorRating => (n === 0 ? "Excellent" : n <= 2 ? "Good" : n <= 4 ? "Fair" : "Needs work");

/** All six factors, in display order. */
export function creditFactors(i: CreditInputs): CreditFactor[] {
  const derog = estimateDerogatoryMarks(i.tier);
  const years = estimateCreditAgeYears(i);
  const inquiries = estimateHardInquiries(i);
  return [
    { id: "card_use", name: "Credit card use", value: `${Math.round(i.utilizationPct)}%`, rating: cardUseRating(i.utilizationPct), impact: "High impact", estimated: false, note: `Of your card limit. Aim under ${LOW_USE_PCT}%.` },
    { id: "payment_history", name: "Payment history", value: `${onTimePct(i.missed12m)}% on time`, rating: missedRating(i.missed12m), impact: "High impact", estimated: false, note: i.missed12m ? `${i.missed12m} missed in the last 12 months` : "No missed payments in 12 months" },
    { id: "derogatory", name: "Derogatory marks", value: String(derog), rating: derogRating(derog), impact: "High impact", estimated: true, note: `Typical for Toyota credit tier ${i.tier}. Collections, bankruptcies and liens aren't visible to us.` },
    { id: "credit_age", name: "Credit age", value: `About ${years} yrs`, rating: ageRating(years), impact: "Medium", estimated: true, note: "Oldest account, assuming credit started around age 18" },
    { id: "total_accounts", name: "Total accounts", value: String(i.accounts), rating: accountsRating(i.accounts), impact: "Low", estimated: false, note: "Only accounts at OneFlow and Toyota. Don't open new ones just to raise this." },
    { id: "inquiries", name: "Hard inquiries", value: String(inquiries), rating: inquiryRating(inquiries), impact: "Low", estimated: true, note: `Typical for Toyota tier ${i.tier}${i.contractStart && monthsBetween(i.contractStart, i.asOf) < INQUIRY_WINDOW_MONTHS ? ", plus your recent Toyota contract" : ""}` },
  ];
}

export interface CreditStep { id: string; title: string; detail: string; points: number | null; amount: Cents | null }

export interface StepInputs extends CreditInputs { cardBalance: Cents; cardLimit: Cents; autopay: boolean }

const scoreAt = (tier: string, utilizationPct: number, missed12m: number) => estimateCreditScore({ tier, utilizationPct, missed12m }).score;
const utilAfter = (balance: Cents, pay: Cents, limit: Cents) => (limit > 0 ? ((balance - pay) / limit) * 100 : 0);

function paydownStep(i: StepInputs, pct: number, current: number): CreditStep | null {
  if (i.cardLimit <= 0 || i.utilizationPct < pct) return null;
  const amount = paymentToReachUtil(i.cardBalance, i.cardLimit, pct);
  if (amount <= 0) return null;
  const points = scoreAt(i.tier, utilAfter(i.cardBalance, amount, i.cardLimit), i.missed12m) - current;
  return { id: `use_${pct}`, title: `Pay your card down to under ${pct}% of the limit`, detail: "One payment this size does it. Scores usually update after your next statement.", points, amount };
}

/** Steps computed from the factors: card paydown milestones (smallest first) and on-time history with estimated points, then advice. */
export function creditSteps(i: StepInputs): CreditStep[] {
  const current = scoreAt(i.tier, i.utilizationPct, i.missed12m);
  const scored = [paydownStep(i, OK_USE_PCT, current), paydownStep(i, LOW_USE_PCT, current)].filter((s): s is CreditStep => s !== null && (s.points ?? 0) >= 0);
  if (i.missed12m > 0) {
    scored.push({ id: "on_time_12m", title: "Pay every bill on time for the next 12 months", detail: `Each missed payment in the last year costs about ${MISSED_POINTS} points in our estimate. They count less as they age.`, points: scoreAt(i.tier, i.utilizationPct, 0) - current, amount: null });
  }
  const advice: CreditStep[] = [];
  if (!i.autopay) advice.push({ id: "autopay", title: "Turn on autopay for your Toyota payment", detail: "The easiest way to never miss a payment.", points: null, amount: null });
  if (estimateDerogatoryMarks(i.tier) > 0) advice.push({ id: "check_reports", title: "Check your free credit reports", detail: "Get them at annualcreditreport.com and dispute anything that isn't yours.", points: null, amount: null });
  advice.push({ id: "no_new_credit", title: "Hold off on new credit applications", detail: "Each hard inquiry dents your score for about a year and stays on your report for two.", points: null, amount: null });
  advice.push({ id: "keep_old_open", title: "Keep your oldest accounts open", detail: "Closing them shortens your credit age and lowers your total limit.", points: null, amount: null });
  return [...scored, ...advice];
}

export interface CreditGoal { target: number; deadline: string }
export type GoalStatus = "met" | "plan" | "out_of_reach" | "past_deadline";
export interface GoalPlan { status: GoalStatus; current: number; target: number; gap: number; months: number; paydown: Cents; monthly: Cents; maxScore: number; needsCleanHistory: boolean }

export const MIN_SCORE = 300;
export const MAX_SCORE = 850;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Stored goal → validated goal, or null. */
export function parseCreditGoal(raw: string | null): CreditGoal | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<CreditGoal> | null;
    if (!v) return null;
    const ok = Number.isInteger(v.target) && (v.target as number) >= MIN_SCORE && (v.target as number) <= MAX_SCORE && typeof v.deadline === "string" && ISO_DATE.test(v.deadline);
    return ok ? { target: v.target as number, deadline: v.deadline as string } : null;
  } catch {
    return null;
  }
}

export interface GoalInputs { goal: CreditGoal; asOf: string; tier: string; utilizationPct: number; missed12m: number; cardBalance: Cents; cardLimit: Cents }

/** Smallest card paydown that reaches the target by the deadline, in our estimate. Missed payments age out after 12 months. */
export function creditGoalPlan(i: GoalInputs): GoalPlan {
  const current = scoreAt(i.tier, i.utilizationPct, i.missed12m);
  const months = monthsBetween(i.asOf, i.goal.deadline);
  const missedAtDeadline = months >= MONTHS_PER_YEAR ? 0 : i.missed12m;
  const base = { current, target: i.goal.target, gap: i.goal.target - current, months: Math.max(0, months), needsCleanHistory: false };
  const maxScore = scoreAt(i.tier, 0, missedAtDeadline);
  if (current >= i.goal.target) return { ...base, status: "met", paydown: 0, monthly: 0, maxScore };
  if (months <= 0) return { ...base, status: "past_deadline", paydown: 0, monthly: 0, maxScore };
  const needsCleanHistory = i.missed12m > 0 && missedAtDeadline === 0;
  const paydown = smallestPaydown(i, missedAtDeadline);
  if (paydown === null) return { ...base, status: "out_of_reach", paydown: 0, monthly: 0, maxScore, needsCleanHistory };
  return { ...base, status: "plan", paydown, monthly: Math.ceil(paydown / months), maxScore, needsCleanHistory };
}

function smallestPaydown(i: GoalInputs, missed: number): Cents | null {
  if (scoreAt(i.tier, i.utilizationPct, missed) >= i.goal.target) return 0;
  if (i.cardLimit <= 0) return null;
  for (let pct = Math.ceil(i.utilizationPct); pct >= 1; pct--) {
    const pay = paymentToReachUtil(i.cardBalance, i.cardLimit, pct);
    if (scoreAt(i.tier, utilAfter(i.cardBalance, pay, i.cardLimit), missed) >= i.goal.target) return pay;
  }
  return scoreAt(i.tier, 0, missed) >= i.goal.target ? i.cardBalance : null;
}
