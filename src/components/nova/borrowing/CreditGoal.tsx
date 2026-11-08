"use client";
import { useState } from "react";
import Link from "next/link";
import { Panel, fmtDate } from "@/components/nova/ui";
import { useStoredValue, writeStored } from "@/lib/bank/storedValue";
import { MAX_SCORE, MIN_SCORE, creditGoalPlan, parseCreditGoal, type CreditGoal, type GoalInputs, type GoalPlan } from "@/lib/bank/credit";
import { addMonths } from "@/lib/bank/view";
import { fmtUSD } from "@/lib/money";

const KEY = (persona: string) => `nova:credit-goal:${persona}`;
const EVT = "nova:credit-goal";
const DEFAULT_GAIN = 30;
const DEFAULT_MONTHS = 6;

type Draft = { target: string; deadline: string };

/** Credit score goal with a deadline, stored per persona in localStorage. */
export function CreditGoalPanel({ persona, inputs }: { persona: string; inputs: Omit<GoalInputs, "goal"> & { current: number } }) {
  const stored = useStoredValue(KEY(persona), EVT, parseCreditGoal, null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fallback: Draft = { target: String(Math.min(MAX_SCORE, inputs.current + DEFAULT_GAIN)), deadline: addMonths(inputs.asOf, DEFAULT_MONTHS) };
  const shown: Draft = draft ?? (stored ? { target: String(stored.target), deadline: stored.deadline } : fallback);

  const save = () => {
    const goal = parseCreditGoal(JSON.stringify({ target: Number(shown.target), deadline: shown.deadline }));
    if (!goal) { setError(`Pick a score from ${MIN_SCORE} to ${MAX_SCORE} and a date.`); return; }
    if (goal.deadline <= inputs.asOf) { setError("Pick a date after today."); return; }
    setError(null);
    setDraft(null);
    writeStored(KEY(persona), EVT, goal);
  };
  const clear = () => { setDraft(null); setError(null); writeStored(KEY(persona), EVT, null); };
  const edit = (patch: Partial<Draft>) => setDraft({ ...shown, ...patch });

  return (
    <Panel title="Your score goal" subtitle="Pick a target and a date. We show what it takes, using the same estimate.">
      <div className="grid grid-cols-2 gap-3">
        <label htmlFor="goal-target" className="block">
          <span className="text-xs font-semibold">Target score</span>
          <input id="goal-target" inputMode="numeric" min={MIN_SCORE} max={MAX_SCORE} type="number" value={shown.target} onChange={(e) => edit({ target: e.target.value })} className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-fg/50" />
        </label>
        <label htmlFor="goal-date" className="block">
          <span className="text-xs font-semibold">By</span>
          <input id="goal-date" type="date" min={inputs.asOf} value={shown.deadline} onChange={(e) => edit({ deadline: e.target.value })} className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-fg/50" />
        </label>
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        <button type="button" className="btn btn-primary" onClick={save}>{stored ? "Update goal" : "Set goal"}</button>
        {stored && <button type="button" className="btn" onClick={clear}>Clear</button>}
      </div>
      {error && <p className="text-sm text-bad mt-2" role="alert">{error}</p>}
      {stored && <GoalResult goal={stored} plan={creditGoalPlan({ ...inputs, goal: stored })} />}
    </Panel>
  );
}

function GoalResult({ goal, plan }: { goal: CreditGoal; plan: GoalPlan }) {
  const by = fmtDate(goal.deadline, true);
  return (
    <div className="mt-4 rounded-xl bg-surface-2 p-3 text-sm" role="status">
      <div className="font-semibold">Goal: {goal.target} by {by}</div>
      {plan.status === "met" && <p className="mt-1">You&apos;re already there in our estimate ({plan.current}). Keep card use low and pay on time.</p>}
      {plan.status === "past_deadline" && <p className="mt-1">That date has passed. Pick a new one.</p>}
      {plan.status === "plan" && (
        <>
          <p className="mt-1">{plan.gap} points to go in {plan.months} month{plan.months === 1 ? "" : "s"}.</p>
          {plan.paydown > 0
            ? <p className="mt-1">Pay your card down by <b className="money">{fmtUSD(plan.paydown)}</b>, about <b className="money">{fmtUSD(plan.monthly)}/mo</b> on top of new spending, and keep it there.</p>
            : <p className="mt-1">No paydown needed: it comes from your missed payments aging out.</p>}
          {plan.needsCleanHistory && <p className="mt-1">This also needs every payment on time until then, so last year&apos;s missed payments age out.</p>}
          <Link href="/debt" className="text-sm font-semibold mt-2 inline-block">See your cards on Debt &amp; liquidity →</Link>
        </>
      )}
      {plan.status === "out_of_reach" && (
        <p className="mt-1">Our estimate tops out around <b>{plan.maxScore}</b> by then, even with your card paid off. Real bureau scores also count things we can&apos;t see, like account age and mix, so a higher score is possible but we can&apos;t promise a date.</p>
      )}
      <p className="text-xs text-muted mt-2">Estimate · not a bureau score.</p>
    </div>
  );
}
