"use client";
import { useEffect, useRef, useState } from "react";
import { useEventFeed } from "@/hooks/useEventFeed";
import { Card } from "./ui/Card";
import { isTerminalEvent } from "@/lib/events/pending";

const SWIPE_CENTS = 80_000;

interface Decided { txId: string; decision?: string; reason?: string; rule?: string; ask?: boolean; decision_source?: string; alreadySettled?: boolean; error?: string }

export function PendingGuard({ personaId, hasKey, accountIds }: { personaId: string; hasKey: boolean; accountIds: string[] }) {
  const feed = useEventFeed(hasKey);
  const mine = new Set(accountIds);
  const pending = feed.pending.filter((e) => e.account_id && mine.has(e.account_id));
  const events = feed.events;
  const [log, setLog] = useState<Decided[]>([]);
  const [swiping, setSwiping] = useState(false);
  const [swipeError, setSwipeError] = useState<string | null>(null);
  const handled = useRef(new Set<string>());

  async function decide(txId: string, decision?: "approve" | "decline") {
    const res = await fetch("/api/decide", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ persona: personaId, txId, decision, reason: decision ? "Owner override from NextMove" : undefined }) });
    const json = (await res.json()) as Decided;
    setLog((l) => [{ ...json, txId }, ...l.filter((x) => x.txId !== txId)].slice(0, 8));
  }

  useEffect(() => {
    for (const e of pending) {
      const id = e.tx_id ?? "";
      if (!id || handled.current.has(id)) continue;
      handled.current.add(id);
      void decide(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  async function swipe() {
    setSwiping(true);
    setSwipeError(null);
    try {
      const res = await fetch("/api/dev/swipe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ persona: personaId, amountCents: SWIPE_CENTS }) });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setSwipeError(res.status === 503 && body.error?.includes("422") ? "The bank rejected the swipe (not enough available credit on the card)." : body.error ?? `Swipe failed (HTTP ${res.status})`);
      }
    } catch {
      setSwipeError("Could not reach the bank. Try again.");
    } finally {
      setSwiping(false);
    }
  }

  const statusOf = (txId: string) => events.find((e) => e.tx_id === txId && isTerminalEvent(e))?.type.replace("transaction.", "");

  return (
    <Card
      eyebrow="Pending-transaction guard · Nessie v2"
      title="The app decides before money settles"
      right={hasKey ? <button type="button" onClick={() => void swipe()} disabled={swiping} className="glass px-3 py-1.5 text-xs font-semibold hover:border-accent disabled:opacity-50">{swiping ? "Swiping…" : "Simulate $800 card swipe"}</button> : <span className="chip text-muted">needs Nessie key</span>}
    >
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
