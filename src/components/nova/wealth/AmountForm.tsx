"use client";
import { useState } from "react";
import { fmtUSD, type Cents } from "@/lib/money";

/** Dollar amount input + submit. Validates > 0 and ≤ max before calling onSubmit (cents). */
export function AmountForm({ label, submitLabel, max, busy, onSubmit, onCancel, initial }: {
  label: string; submitLabel: string; max: Cents; busy?: boolean; initial?: Cents;
  onSubmit: (cents: Cents) => void; onCancel?: () => void;
}) {
  const [text, setText] = useState(initial ? (initial / 100).toFixed(2) : "");
  const [err, setErr] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cents = Math.round(Number(text) * 100);
    if (!Number.isFinite(cents) || cents <= 0) return setErr("Enter an amount above $0");
    if (cents > max) return setErr(`Most you can move is ${fmtUSD(max)}`);
    setErr(null);
    onSubmit(cents);
  };
  return (
    <form onSubmit={submit} className="mt-2">
      <div className="flex gap-2 items-center">
        <label className="sr-only" htmlFor={`amt-${label}`}>{label}</label>
        <span className="text-sm text-muted">$</span>
        <input id={`amt-${label}`} inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} placeholder="0.00"
          className="min-w-0 flex-1 rounded-full border border-line bg-surface px-3 py-1.5 text-sm" />
        <button type="submit" className="btn btn-primary text-sm" disabled={busy}>{busy ? "Moving…" : submitLabel}</button>
        {onCancel && <button type="button" className="btn text-sm" onClick={onCancel}>Cancel</button>}
      </div>
      {err && <p role="alert" className="text-xs text-bad mt-1">{err}</p>}
    </form>
  );
}
