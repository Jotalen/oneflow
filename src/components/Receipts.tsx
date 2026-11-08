"use client";
import type { Receipt } from "@/hooks/useExecute";

export function Receipts({ receipts }: { receipts: Receipt[] }) {
  if (receipts.length === 0) return null;
  return (
    <div className="space-y-2">
      {receipts.map((r, i) => (
        <div key={`${r.moveId}-${i}`} className={`glass p-3 text-sm border-l-4 ${r.ok ? (r.settled ? "border-l-good" : "border-l-warn") : "border-l-bad"}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{r.title}</span>
            {r.ok ? (
              <span className={`chip ${r.settled ? "text-good" : "text-warn"}`}>{r.simulated ? "simulated (no Nessie key)" : r.settled ? "completed in Nessie" : "pending in Nessie…"}</span>
            ) : (
              <span className="chip text-bad">failed: {r.error}</span>
            )}
          </div>
          {r.receipt.length > 0 && <ul className="mt-1 text-xs text-muted list-disc pl-4">{r.receipt.map((l, j) => <li key={j}>{l}</li>)}</ul>}
          {r.txIds.length > 0 && <div className="mt-1 text-[0.7rem] font-mono text-muted">tx {r.txIds.join(", ")}</div>}
        </div>
      ))}
    </div>
  );
}
