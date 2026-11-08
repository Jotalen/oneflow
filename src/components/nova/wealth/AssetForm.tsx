"use client";
import { useState, type FormEvent } from "react";
import { MAX_ASSET_NAME, validateAsset, type OwnedAsset } from "@/lib/bank/wealth";

const FIELD = "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-fg";

/** Name + estimated value for something the customer owns. Validates before calling onSubmit (cents). */
export function AssetForm({ initial, submitLabel, onSubmit, onCancel }: {
  initial?: Omit<OwnedAsset, "id">; submitLabel: string; onSubmit: (a: Omit<OwnedAsset, "id">) => void; onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [value, setValue] = useState(initial ? (initial.value / 100).toFixed(2) : "");
  const [err, setErr] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = validateAsset(name, value);
    if (!r.ok) return setErr(r.error);
    setErr(null);
    onSubmit({ name: r.name, value: r.value });
  };
  return (
    <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[1fr_10rem] rounded-xl bg-surface-2 p-3 mt-2">
      <label className="text-xs text-muted">What is it?
        <input className={FIELD} value={name} maxLength={MAX_ASSET_NAME} onChange={(e) => setName(e.target.value)} placeholder="Home, boat, jewelry…" />
      </label>
      <label className="text-xs text-muted">Your estimate ($)
        <input className={FIELD} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="25000" />
      </label>
      {err && <p role="alert" className="text-xs text-bad sm:col-span-2">{err}</p>}
      <p className="text-xs text-muted sm:col-span-2">Only you see this. It&apos;s your estimate, not a bank valuation, and it&apos;s saved on this device.</p>
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className="btn btn-primary text-sm">{submitLabel}</button>
        <button type="button" className="btn text-sm" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
