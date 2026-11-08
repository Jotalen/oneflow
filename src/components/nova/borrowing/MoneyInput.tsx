"use client";
import type { Cents } from "@/lib/money";

const MAX_DOLLARS = 100_000_000;

/** Whole-dollar input that reports cents. Non-numbers and negatives become 0. */
export function MoneyInput({ id, label, cents, onChange }: { id: string; label: string; cents: Cents; onChange: (c: Cents) => void }) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-xs font-semibold">{label}</span>
      <div className="mt-1 flex items-center rounded-xl border border-line bg-surface px-3 py-2 focus-within:border-fg/50">
        <span className="text-muted text-sm">$</span>
        <input
          id={id}
          inputMode="numeric"
          className="w-full bg-transparent pl-1 text-sm outline-none money"
          value={cents ? Math.round(cents / 100).toLocaleString("en-US") : ""}
          placeholder="0"
          onChange={(e) => {
            const n = Number(e.target.value.replace(/[^0-9]/g, ""));
            onChange(Number.isFinite(n) ? Math.min(n, MAX_DOLLARS) * 100 : 0);
          }}
        />
      </div>
    </label>
  );
}

/** Range slider in whole dollars, reporting cents. */
export function DollarSlider({ id, label, cents, max, step, onChange }: { id: string; label: string; cents: Cents; max: number; step: number; onChange: (c: Cents) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <label htmlFor={id}>{label}</label>
        <span className="font-semibold money">+${Math.round(cents / 100)}</span>
      </div>
      <input id={id} type="range" min={0} max={max} step={step} value={Math.round(cents / 100)} onChange={(e) => onChange(Number(e.target.value) * 100)} className="w-full mt-2 accent-[var(--accent)]" />
    </div>
  );
}
