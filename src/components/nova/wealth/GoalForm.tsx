"use client";
import { useState } from "react";
import type { Cents } from "@/lib/money";

export interface GoalDraft { name: string; target: Cents; monthly: Cents }
const MAX_NAME = 40;

const toCents = (s: string) => Math.round(Number(s) * 100);

/** New/edit goal form with validation. */
export function GoalForm({ initial, submitLabel, onSubmit, onCancel }: { initial?: GoalDraft; submitLabel: string; onSubmit: (g: GoalDraft) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [target, setTarget] = useState(initial ? String(initial.target / 100) : "");
  const [monthly, setMonthly] = useState(initial ? String(initial.monthly / 100) : "");
  const [err, setErr] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    const t = toCents(target);
    const m = monthly.trim() === "" ? 0 : toCents(monthly);
    if (!n || n.length > MAX_NAME) return setErr(`Name is required (up to ${MAX_NAME} characters)`);
    if (!Number.isFinite(t) || t <= 0) return setErr("Target must be above $0");
    if (!Number.isFinite(m) || m < 0) return setErr("Monthly amount can't be negative");
    setErr(null);
    onSubmit({ name: n, target: t, monthly: m });
  };
  const field = "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-sm";
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
      <label className="text-xs text-muted">Goal name<input className={field} value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_NAME} placeholder="Spring trip" /></label>
      <label className="text-xs text-muted">Target ($)<input className={field} inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="2000" /></label>
      <label className="text-xs text-muted">Plan to save per month ($)<input className={field} inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="100" /></label>
      {err && <p role="alert" className="text-xs text-bad sm:col-span-3">{err}</p>}
      <div className="flex gap-2 sm:col-span-3">
        <button type="submit" className="btn btn-primary text-sm">{submitLabel}</button>
        <button type="button" className="btn text-sm" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
