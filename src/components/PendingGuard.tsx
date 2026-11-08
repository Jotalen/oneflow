"use client";
import type { PendingGuardState } from "@/hooks/usePendingGuard";
import { Card } from "./ui/Card";

/** Display for the always-on guard (usePendingGuard); the decisions happen even when this is hidden. */
export function PendingGuard({ hasKey, guard }: { hasKey: boolean; guard: PendingGuardState }) {
  const { log, decide, swipe, swiping, swipeError, statusOf } = guard;
  return (
    <Card
      eyebrow="Pending-transaction guard · Nessie v2"
      title="The app decides before money settles"
      right={hasKey ? null : <span className="chip text-muted">needs Nessie key</span>}
    >
      {hasKey && (
        <div className="flex flex-wrap gap-2 mb-3">
          <button type="button" onClick={() => void swipe("retail")} disabled={swiping} className="glass px-3 py-1.5 text-xs font-semibold hover:border-accent disabled:opacity-50">{swiping ? "Swiping…" : "Simulate $800 swipe at Target"}</button>
          <button type="button" onClick={() => void swipe("gambling")} disabled={swiping} className="glass px-3 py-1.5 text-xs font-semibold hover:border-accent disabled:opacity-50">{swiping ? "Swiping…" : "Simulate $800 casino charge"}</button>
        </div>
      )}
      {swipeError && <p role="alert" className="text-xs text-bad mb-2">{swipeError}</p>}
      <p className="text-xs text-muted mb-3">Rules: decline if over half of liquid cash or a blocked category · ask if over $500 with under 1 month of runway · otherwise approve. You can override.</p>
      {log.length === 0 ? (
        <p className="text-sm text-muted">No pending transactions seen yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {log.map((d) => (
            <li key={d.txId} className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted">{d.txId.slice(0, 8)}…</span>
              {d.error ? <span className="chip text-bad">{d.error}</span> : d.ask ? (
                <>
                  <span className="chip text-warn">ask</span>
                  <span>{d.reason}</span>
                  <button className="chip hover:border-accent" onClick={() => void decide(d.txId, "approve")}>approve</button>
                  <button className="chip text-bad hover:border-accent" onClick={() => void decide(d.txId, "decline")}>decline</button>
                </>
              ) : (
                <>
                  <span className={`chip ${d.decision === "decline" ? "text-bad" : "text-good"}`}>{d.alreadySettled ? "already settled" : d.decision}</span>
                  <span>{d.reason}</span>
                  {d.rule && <span className="text-xs text-muted">rule: {d.rule}</span>}
                  {d.decision_source && <span className="text-xs text-muted">source: {d.decision_source}</span>}
                  {statusOf(d.txId) && <span className="text-xs text-muted">→ {statusOf(d.txId)}</span>}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
