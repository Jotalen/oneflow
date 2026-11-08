"use client";
import { useState } from "react";
import { Bar } from "@/components/nova/ui";
import type { Budget } from "@/lib/bank/view";
import type { BudgetOverrides } from "@/lib/bank/everyday";
import { fmtUSD, parseCents } from "@/lib/money";

const PCT = 100;

/** Categories table; in edit mode flexible limits become inputs (fixed bills stay read-only). */
export function BudgetCategories({ budget, editing, overrides, onSave, onCancel }: {
  budget: Budget; editing: boolean; overrides: BudgetOverrides; onSave: (o: BudgetOverrides) => void; onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(budget.categories.map((c) => [c.key, (c.limit / 100).toFixed(0)])));
  const [error, setError] = useState("");

  const save = () => {
    const next: BudgetOverrides = { ...overrides };
    for (const c of budget.categories.filter((x) => !x.fixed)) {
      const raw = draft[c.key] ?? "";
      const cents = parseCents(raw);
      if (cents === null || cents < 0) { setError(`Enter a dollar amount for ${c.label}`); return; }
      next[c.key] = cents;
    }
    setError("");
    onSave(next);
  };

  return (
    <div>
      <ul className="divide-y divide-line">
        {budget.categories.map((c) => {
          const over = c.spent > c.limit;
          return (
            <li key={c.key} className={`grid grid-cols-2 sm:grid-cols-[10rem_1fr_11rem_9rem] items-center gap-x-4 gap-y-1 py-2.5 px-2 -mx-2 rounded-lg ${over ? "bg-surface-2" : ""}`}>
              <div className="text-sm font-semibold">{c.label}{c.fixed && <span className="text-xs text-muted font-normal"> · fixed</span>}</div>
              <div className="col-span-2 sm:col-span-1 order-last sm:order-none"><Bar pct={c.limit ? (c.spent / c.limit) * PCT : c.spent ? PCT : 0} tone={over ? "bad" : "ink"} /></div>
              <div className="text-sm money text-right sm:text-left">
                {editing && !c.fixed ? (
                  <label className="inline-flex items-center gap-1">{fmtUSD(c.spent)} of $
                    <input aria-label={`${c.label} limit in dollars`} inputMode="decimal" className="w-20 rounded-md border border-line bg-surface px-1.5 py-0.5"
                      value={draft[c.key] ?? ""} onChange={(e) => setDraft({ ...draft, [c.key]: e.target.value })} />
                  </label>
                ) : `${fmtUSD(c.spent)} of ${fmtUSD(c.limit)}`}
              </div>
              <div className={`col-span-2 sm:col-span-1 text-xs sm:text-sm ${over ? "font-semibold text-bad" : "text-muted"}`}>{over ? "⚠ " : ""}{c.note}</div>
            </li>
          );
        })}
      </ul>
      {editing && (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button className="btn btn-primary" onClick={save}>Save budget</button>
          <button className="btn" onClick={onCancel}>Cancel</button>
          {Object.keys(overrides).length > 0 && <button className="btn" onClick={() => onSave({})}>Reset to suggested</button>}
          {error && <span role="alert" className="text-sm text-bad">{error}</span>}
          <span className="text-xs text-muted w-full">Suggested limits come from your last 8 weeks of spending. Your edits are saved on this device.</span>
        </div>
      )}
    </div>
  );
}
