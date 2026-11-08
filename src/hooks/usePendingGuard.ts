"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEventFeed } from "@/hooks/useEventFeed";
import { isTerminalEvent } from "@/lib/events/pending";

export const SWIPE_CENTS = 80_000;
export type SwipeCategory = "retail" | "gambling";
const LOG_SIZE = 8;

export interface GuardLogEntry { personaId: string; txId: string; decision?: string; reason?: string; rule?: string; ask?: boolean; decision_source?: string; alreadySettled?: boolean; error?: string }

export interface PendingGuardState {
  log: GuardLogEntry[];
  decide: (txId: string, decision?: "approve" | "decline") => Promise<void>;
  /** Real Nessie card purchase; "gambling" goes to a casino merchant the guard's blocked-category rule declines. */
  swipe: (merchantCategory?: SwipeCategory) => Promise<void>;
  swiping: boolean;
  swipeError: string | null;
  statusOf: (txId: string) => string | undefined;
}

const postJson = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

/**
 * Pending-transaction guard (ADR-005). Runs whenever the app is open with a live bank, not only
 * while the notifications popover is showing, so it decides before the pending window elapses.
 */
export function usePendingGuard(personaId: string, enabled: boolean, accountIds: string[]): PendingGuardState {
  const feed = useEventFeed(enabled);
  const [log, setLog] = useState<GuardLogEntry[]>([]);
  const [swiping, setSwiping] = useState(false);
  const [swipeError, setSwipeError] = useState<string | null>(null);
  const handled = useRef(new Set<string>());
  const accountKey = accountIds.join(",");
  const pending = useMemo(() => {
    const mine = new Set(accountKey.split(","));
    return feed.pending.filter((e) => e.account_id && mine.has(e.account_id));
  }, [feed.pending, accountKey]);

  async function decide(txId: string, decision?: "approve" | "decline") {
    let entry: GuardLogEntry;
    try {
      const res = await postJson("/api/decide", { persona: personaId, txId, decision, reason: decision ? "Owner override from NextMove" : undefined });
      const json = (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as Omit<GuardLogEntry, "personaId" | "txId">;
      entry = { ...json, personaId, txId };
    } catch {
      entry = { personaId, txId, error: "Could not reach the bank" };
    }
    setLog((l) => [entry, ...l.filter((x) => x.txId !== txId)].slice(0, LOG_SIZE));
  }

  useEffect(() => {
    for (const e of pending) {
      const id = e.tx_id ?? "";
      if (!id || handled.current.has(id)) continue;
      handled.current.add(id);
      void decide(id);
    }
    // decide only reads personaId, which `pending` is already scoped to via accountIds
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  async function swipe(merchantCategory: SwipeCategory = "retail") {
    setSwiping(true);
    setSwipeError(null);
    try {
      const res = await postJson("/api/dev/swipe", { persona: personaId, amountCents: SWIPE_CENTS, merchantCategory });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setSwipeError(body.error ?? `Swipe failed (HTTP ${res.status})`);
      }
    } catch {
      setSwipeError("Could not reach the bank. Try again.");
    } finally {
      setSwiping(false);
    }
  }

  const statusOf = (txId: string) => feed.events.find((e) => e.tx_id === txId && isTerminalEvent(e))?.type.replace("transaction.", "");

  return { log: log.filter((x) => x.personaId === personaId), decide, swipe, swiping, swipeError, statusOf };
}
