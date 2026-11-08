"use client";
import { useState } from "react";
import type { BudgetCategory } from "@/lib/bank/view";
import type { BudgetOverrides } from "@/lib/bank/everyday";
import { MAX_CATEGORY_LIMIT, type BudgetMode } from "@/lib/bank/budgetPlan";
import { fmtUSD, parseCents } from "@/lib/money";

const HELP: Record<BudgetMode, string> = {
  auto: "Suggested amounts come from your last 8 weeks of spending. Change any you like; bills stay at their real amounts.",
  manual: "Set your own amount for each category. Leave one blank for $0. Bills stay at their real amounts.",
};

const toInput = (c: number) => (c ? String(Math.round(c / 100)) : "");

function parseRows(rows: BudgetCategory[], draft: Record<string, string>): { amounts: BudgetOverrides } | { error: string } {
  const parsed = rows.filter((x) => !x.fixed).map((c) => {
    const raw = (draft[c.key] ?? "").trim();
    return { c, cents: raw === "" ? 0 : parseCents(raw) };
  });
  const invalid = parsed.find((p) => p.cents === null || p.cents < 0);
  if (invalid) return { error: `Enter a dollar amount for ${invalid.c.label}` };
  const tooBig = parsed.find((p) => (p.cents ?? 0) > MAX_CATEGORY_LIMIT);
  if (tooBig) return { error: `${tooBig.c.label} must be under ${fmtUSD(MAX_CATEGORY_LIMIT)}` };
  return { amounts: Object.fromEntries(parsed.map((p) => [p.c.key, p.cents ?? 0])) };
}

/** Edit monthly amounts per category. Bills (fixed) are shown read-only. */
export function BudgetCategories({ rows, mode, canReset, onSave, onCancel, onReset }: {
  rows: BudgetCategory[]; mode: BudgetMode; canReset: boolean;
  onSave: (amounts: BudgetOverrides) => void; onCancel: () => void; onReset: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((c) => [c.key, toInput(c.limit)])));
  const [error, setError] = useState("");

  const save = () => {
    const out = parseRows(rows, draft);
    if ("error" in out) { setError(out.error); return; }
    setError("");
    onSave(out.amounts);
  };

  return (
    <div>
      <p className="text-xs text-muted mb-2">{HELP[mode]}</p>
      <ul className="divide-y divide-line">
        {rows.map((c) => (
          <li key={c.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
            <div className="min-w-0">
              <div className="text-sm font-semibold">{c.label}</div>
              <div className="text-xs text-muted">{c.fixed ? `${c.detail ?? "Bills"} · fixed` : `${fmtUSD(c.spent)} spent this month`}</div>
            </div>
            {c.fixed ? <div className="text-sm money">{fmtUSD(c.limit)}</div> : (
              <label className="inline-flex items-center gap-1 text-sm">$
                <input name={`budget-${c.key}`} aria-label={`${c.label} monthly budget in dollars`} inputMode="decimal" placeholder="0"
                  className="w-24 rounded-md border border-line bg-surface px-2 py-1 money"
                  value={draft[c.key] ?? ""} onChange={(e) => setDraft({ ...draft, [c.key]: e.target.value })} />
              </label>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button className="btn btn-primary" onClick={save}>Save budget</button>
        <button className="btn" onClick={onCancel}>Cancel</button>
        {canReset && <button className="btn" onClick={onReset}>Reset to suggested</button>}
        {error && <span role="alert" className="text-sm text-bad">{error}</span>}
        <span className="text-xs text-muted w-full">Saved on this device for this customer.</span>
      </div>
    </div>
  );
}
