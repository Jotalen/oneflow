"use client";
import { useState, type FormEvent } from "react";
import { fmtMonth } from "@/components/nova/ui";
import { AS_OF } from "@/lib/engine/types";
import { addMonths } from "@/lib/bank/view";
import { planGoal, type GoalPlan, type GoalPlanMode } from "@/lib/bank/goals";
import { fmtUSD, parseCents, type Cents } from "@/lib/money";

export interface GoalDraft { name: string; target: Cents; monthly: Cents; deadline?: string }
const MAX_NAME = 40;
const FIELD = "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-fg";
const MODES: { value: GoalPlanMode; label: string }[] = [
  { value: "deadline", label: "By a date" },
  { value: "monthly", label: "By a monthly amount" },
];

const monthsText = (n: number) => `${n} month${n === 1 ? "" : "s"}`;

function planText(plan: GoalPlan, mode: GoalPlanMode): string {
  if (!plan.ok) return "";
  if (plan.months === 0) return "You've already saved enough for this target.";
  if (mode === "deadline") return `Save ${fmtUSD(plan.monthly)} a month for ${monthsText(plan.months)} to get there by ${fmtMonth(plan.reachDate)}.`;
  return `At ${fmtUSD(plan.monthly)} a month you'll reach it by ${fmtMonth(plan.reachDate)} (${monthsText(plan.months)}).`;
}

/** New/edit goal: pick a deadline (→ monthly amount needed) or a monthly amount (→ the date you'll reach it). */
export function GoalForm({ initial, saved = 0, submitLabel, onSubmit, onCancel }: {
  initial?: GoalDraft; saved?: Cents; submitLabel: string; onSubmit: (g: GoalDraft) => void; onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [target, setTarget] = useState(initial ? String(initial.target / 100) : "");
  const [mode, setMode] = useState<GoalPlanMode>(initial && !initial.deadline ? "monthly" : "deadline");
  const [deadline, setDeadline] = useState(initial?.deadline ?? "");
  const [monthly, setMonthly] = useState(initial?.monthly ? String(initial.monthly / 100) : "");
  const [err, setErr] = useState<string | null>(null);

  const targetCents = parseCents(target) ?? 0;
  const plan = planGoal({ target: targetCents, saved, mode, deadline: deadline || undefined, monthly: parseCents(monthly) ?? 0 });
  const filled = targetCents > 0 && (mode === "deadline" ? !!deadline : monthly.trim() !== "");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n || n.length > MAX_NAME) return setErr(`Name is required (up to ${MAX_NAME} characters)`);
    if (!plan.ok) return setErr(plan.error);
    setErr(null);
    onSubmit({ name: n, target: targetCents, monthly: plan.monthly, deadline: plan.deadline });
  };

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs text-muted">Goal name<input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_NAME} placeholder="Spring trip" /></label>
      <label className="text-xs text-muted">Target ($)<input className={FIELD} inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="2000" /></label>
      <fieldset className="sm:col-span-2">
        <legend className="text-xs text-muted mb-1">Plan it</legend>
        <div className="inline-flex flex-wrap rounded-full bg-surface-2 p-1 gap-1">
          {MODES.map((m) => (
            <button key={m.value} type="button" aria-pressed={mode === m.value} onClick={() => { setMode(m.value); setErr(null); }}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${mode === m.value ? "bg-ink text-ink-fg" : "text-fg/80 hover:text-fg"}`}>
              {m.label}
            </button>
          ))}
        </div>
      </fieldset>
      {mode === "deadline" ? (
        <label className="text-xs text-muted">Reach it by
          <input type="date" className={FIELD} value={deadline} min={addMonths(AS_OF, 1)} onChange={(e) => setDeadline(e.target.value)} />
        </label>
      ) : (
        <label className="text-xs text-muted">Save per month ($)
          <input className={FIELD} inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="100" />
        </label>
      )}
      <p className="text-sm self-end sm:pb-1.5" role="status" aria-live="polite">
        {filled ? (plan.ok ? planText(plan, mode) : <span className="text-bad">{plan.error}</span>) : <span className="text-muted text-xs">{mode === "deadline" ? "Pick a date to see the monthly amount." : "Enter an amount to see when you'll reach it."}</span>}
      </p>
      {err && <p role="alert" className="text-xs text-bad sm:col-span-2">{err}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className="btn btn-primary text-sm">{submitLabel}</button>
        <button type="button" className="btn text-sm" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
