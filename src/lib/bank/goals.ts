"use client";
import { useCallback } from "react";
import { useStoredValue, writeStored } from "./storedValue";
import type { Cents } from "@/lib/money";
import { AS_OF } from "@/lib/engine/types";
import { addMonths, monthsToTarget } from "./view";

/**
 * Savings goals. Nessie has no goal object, so goals are envelopes inside the persona's real
 * savings account, stored per persona in localStorage. "Add money" moves real money
 * checking → savings in Nessie (/api/transfer) and credits the envelope.
 */
export interface Goal {
  id: string; name: string; target: Cents; saved: Cents; monthly: Cents; createdAt: string;
  history: { date: string; amount: Cents; note: string }[];
  /** Target date ("YYYY-MM-DD") when the plan was set by deadline; absent when set by monthly amount. */
  deadline?: string;
}

/** Longest plan we show: past 30 years a date or monthly amount isn't meaningful. */
export const MAX_PLAN_MONTHS = 360;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Whole months from `from` to `to` (a day short of the month mark counts one fewer). */
export function monthsUntil(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0);
}

/** Monthly amount (rounded up to the cent) that reaches `target` by `deadline`; null if under a month away. */
export function monthlyForDeadline(target: Cents, saved: Cents, deadline: string, from: string = AS_OF): { months: number; monthly: Cents } | null {
  const months = monthsUntil(from, deadline);
  if (months < 1) return null;
  return { months, monthly: Math.ceil(Math.max(0, target - saved) / months) };
}

/** Date the goal is reached saving `monthly` a month; null if it never is. */
export function reachDateFor(target: Cents, saved: Cents, monthly: Cents, from: string = AS_OF): string | null {
  const m = monthsToTarget(saved, target, monthly);
  return Number.isFinite(m) ? addMonths(from, m) : null;
}

export type GoalPlanMode = "deadline" | "monthly";
export interface GoalPlanInput { target: Cents; saved: Cents; mode: GoalPlanMode; deadline?: string; monthly?: Cents }
export type GoalPlan =
  | { ok: true; monthly: Cents; months: number; reachDate: string; deadline?: string }
  | { ok: false; error: string };

/** Pick a date (→ the monthly amount needed) or a monthly amount (→ the date you'll reach it). */
export function planGoal(input: GoalPlanInput, from: string = AS_OF): GoalPlan {
  const { target, saved, mode } = input;
  if (!Number.isFinite(target) || target <= 0) return { ok: false, error: "Target must be above $0" };
  if (mode === "deadline") return planByDeadline(target, saved, input.deadline, from);
  const monthly = input.monthly ?? 0;
  if (!Number.isFinite(monthly) || monthly <= 0) return { ok: false, error: "Enter a monthly amount above $0" };
  const months = monthsToTarget(saved, target, monthly);
  if (months > MAX_PLAN_MONTHS) return { ok: false, error: "At that amount it would take more than 30 years. Try a bigger monthly amount." };
  return { ok: true, monthly, months, reachDate: addMonths(from, months) };
}

function planByDeadline(target: Cents, saved: Cents, deadline: string | undefined, from: string): GoalPlan {
  if (!deadline || !ISO_DATE.test(deadline) || Number.isNaN(Date.parse(deadline))) return { ok: false, error: "Pick a date" };
  const r = monthlyForDeadline(target, saved, deadline, from);
  if (!r) return { ok: false, error: "Pick a date at least a month from now" };
  if (r.months > MAX_PLAN_MONTHS) return { ok: false, error: "Pick a date within 30 years" };
  const months = monthsToTarget(saved, target, r.monthly);
  return { ok: true, monthly: r.monthly, months, reachDate: addMonths(from, months), deadline };
}
const KEY = (persona: string) => `nova:goals:${persona}`;
const EVT = "nova:goals";
const NO_GOALS: Goal[] = [];
const parseGoals = (raw: string | null): Goal[] => (raw ? (JSON.parse(raw) as Goal[]) : NO_GOALS);

function read(persona: string): Goal[] {
  try { return parseGoals(localStorage.getItem(KEY(persona))); } catch { return NO_GOALS; }
}
function write(persona: string, goals: Goal[]) {
  writeStored(KEY(persona), EVT, goals);
}

export function useGoals(persona: string) {
  const goals = useStoredValue(KEY(persona), EVT, parseGoals, NO_GOALS);

  const add = useCallback((g: Omit<Goal, "id" | "createdAt" | "history" | "saved">) => {
    const today = new Date().toISOString().slice(0, 10);
    write(persona, [...read(persona), { ...g, saved: 0, id: `g${Date.now()}`, createdAt: today, history: [] }]);
  }, [persona]);
  const credit = useCallback((id: string, amount: Cents, note: string) => {
    const today = new Date().toISOString().slice(0, 10);
    write(persona, read(persona).map((g) => (g.id === id ? { ...g, saved: g.saved + amount, history: [{ date: today, amount, note }, ...g.history] } : g)));
  }, [persona]);
  const update = useCallback((id: string, patch: Partial<Pick<Goal, "name" | "target" | "monthly" | "deadline">>) => {
    write(persona, read(persona).map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }, [persona]);
  const remove = useCallback((id: string) => write(persona, read(persona).filter((g) => g.id !== id)), [persona]);
  return { goals, add, credit, update, remove };
}
