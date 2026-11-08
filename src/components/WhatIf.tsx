"use client";
import { useEffect, useMemo, useState } from "react";
import type { Profile } from "@/lib/engine/types";
import { project, type ProfileOverrides } from "@/lib/engine/project";
import { fmtUSD } from "@/lib/money";
import { Card } from "./ui/Card";
import { TwoFutures } from "./TwoFutures";

const DEBOUNCE_MS = 150;
const EXTRA_MAX = 50_000;
const INCOME_MIN = -100_000;
const INCOME_MAX = 200_000;
const EXPENSE_MAX = 500_000;

function useDebounced<T>(v: T, ms: number): T {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

/** Two or three sliders re-running the deterministic projection client-side (F: what-if). */
export function WhatIf({ profile }: { profile: Profile }) {
  const [extra, setExtra] = useState(0);
  const [income, setIncome] = useState(0);
  const [expense, setExpense] = useState(0);
  const d = useDebounced({ extra, income, expense }, DEBOUNCE_MS);
  const baseline = useMemo(() => project(profile), [profile]);
  const applied = useMemo(() => {
    const o: Partial<ProfileOverrides> = {};
    if (d.extra) o.extraToDebtMonthly = d.extra;
    if (d.income) o.incomeMonthlyDelta = d.income;
    if (d.expense) o.oneTimeExpense = { month: 1, amount: d.expense };
    return project(profile, 24, o);
  }, [profile, d]);
  const gap = applied.netWorth24 - baseline.netWorth24;
  const topDebt = [...profile.debts].filter((x) => x.aprPct > 0).sort((a, b) => b.aprPct - a.aprPct)[0];
  return (
    <Card eyebrow="Try it" title="What if…" right={<span className={`money font-semibold ${gap >= 0 ? "text-good" : "text-bad"}`}>{gap >= 0 ? "+" : ""}{fmtUSD(gap)} by month 24</span>}>
      <div className="grid gap-4 sm:grid-cols-3 mb-4">
        <Slider label={`Extra toward ${topDebt?.label ?? "debt"} / mo`} value={extra} min={0} max={EXTRA_MAX} step={2_500} onChange={setExtra} fmt={fmtUSD} />
        <Slider label="Monthly income change" value={income} min={INCOME_MIN} max={INCOME_MAX} step={5_000} onChange={setIncome} fmt={(v) => (v >= 0 ? "+" : "") + fmtUSD(v)} />
        <Slider label="One-time expense next month" value={expense} min={0} max={EXPENSE_MAX} step={10_000} onChange={setExpense} fmt={fmtUSD} />
      </div>
      <TwoFutures baseline={baseline} applied={applied} appliedLabel="What if" />
      <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-muted">
        <div>Lowest cash point: <span className={`money ${applied.liquidMin < 0 ? "text-bad" : ""}`}>{fmtUSD(applied.liquidMin)}</span></div>
        <div>Overdraft fees: <span className="money">{fmtUSD(applied.feesTotal)}</span></div>
        <div>Net worth month 24: <span className="money">{fmtUSD(applied.netWorth24)}</span></div>
      </div>
    </Card>
  );
}

function Slider({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string }) {
  return (
    <label className="block text-sm">
      <div className="flex justify-between mb-1"><span className="text-muted">{label}</span><span className="money font-semibold">{fmt(value)}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[#7dd3fc]" />
    </label>
  );
}
