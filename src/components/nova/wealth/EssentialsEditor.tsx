"use client";
import { useState, type FormEvent } from "react";
import { fmtUSD, parseCents, type Cents } from "@/lib/money";
import { MAX_ESSENTIAL, type EssentialItem } from "@/lib/bank/wealth";

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden focusable="false">
      <rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function AmountEdit({ item, onSave, onCancel }: { item: EssentialItem; onSave: (c: Cents) => void; onCancel: () => void }) {
  const [text, setText] = useState((item.value / 100).toFixed(2));
  const [err, setErr] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const c = parseCents(text);
    if (c === null || c < 0) return setErr("Enter $0 or more");
    if (c > MAX_ESSENTIAL) return setErr(`Up to ${fmtUSD(MAX_ESSENTIAL)} a month`);
    onSave(c);
  };
  return (
    <form onSubmit={submit} className="mt-2">
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`ess-${item.key}`}>{item.label} per month</label>
        <span className="text-sm text-muted">$</span>
        <input id={`ess-${item.key}`} inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)}
          className="min-w-0 flex-1 rounded-full border border-line bg-surface px-3 py-1.5 text-sm" />
        <button type="submit" className="btn btn-primary text-sm">Save</button>
        <button type="button" className="btn text-sm" onClick={onCancel}>Cancel</button>
      </div>
      {err && <p role="alert" className="text-xs text-bad mt-1">{err}</p>}
    </form>
  );
}

/** Monthly essentials: flexible rows can be changed by the customer; fixed bills stay locked. */
export function EssentialsEditor({ items, onChange }: { items: EssentialItem[]; onChange: (key: string, cents: Cents | null) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  if (!items.length) return <p className="text-sm text-muted">We don&apos;t see recurring essentials yet.</p>;
  return (
    <ul className="divide-y divide-line">
      {items.map((e) => (
        <li key={e.key} className="py-2.5 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div>{e.label}</div>
              {e.fixed ? (
                <div className="text-xs text-muted flex items-center gap-1 mt-0.5"><LockIcon />Fixed bill</div>
              ) : e.adjusted ? (
                <div className="text-xs text-muted mt-0.5">Your amount · our estimate was {fmtUSD(e.estimate)}</div>
              ) : (
                <div className="text-xs text-muted mt-0.5">Our estimate from your spending</div>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="font-semibold money">{fmtUSD(e.value)}</div>
              {!e.fixed && editing !== e.key && (
                <div className="flex gap-3 justify-end text-xs font-semibold mt-0.5">
                  <button type="button" className="hover:underline" onClick={() => setEditing(e.key)} aria-label={`Change ${e.label}`}>Change</button>
                  {e.adjusted && <button type="button" className="hover:underline text-muted" onClick={() => onChange(e.key, null)} aria-label={`Reset ${e.label}`}>Reset</button>}
                </div>
              )}
            </div>
          </div>
          {editing === e.key && <AmountEdit item={e} onSave={(c) => { onChange(e.key, c === e.estimate ? null : c); setEditing(null); }} onCancel={() => setEditing(null)} />}
        </li>
      ))}
    </ul>
  );
}
