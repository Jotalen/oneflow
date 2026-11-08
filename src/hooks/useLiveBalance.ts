"use client";
import { useEffect, useMemo, useRef } from "react";
import type { Analysis } from "@/lib/engine/analyze";
import { balanceEventsFor } from "@/lib/events/settled";
import { useEventFeed } from "./useEventFeed";

/** Wait for a burst of events (a transfer settles both sides) before reloading once. */
const DEBOUNCE_MS = 800;

/**
 * Keeps balances live on every open screen: when the shared bank event feed reports a new hold or a
 * settled transaction on one of this customer's accounts (from this tab, another tab, or another
 * device), reload the profile straight from the bank.
 */
export function useLiveBalance(data: Analysis | null, live: boolean, refresh: () => Promise<void>): void {
  const { events } = useEventFeed(live);
  const seen = useRef<ReadonlySet<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const accountIds = useMemo(() => new Set(data?.profile.accounts.map((a) => a.id) ?? []), [data]);

  useEffect(() => {
    const fresh = balanceEventsFor(events, accountIds, seen.current);
    if (fresh.length === 0) return;
    seen.current = new Set([...seen.current, ...fresh]);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void refresh(), DEBOUNCE_MS);
  }, [events, accountIds, refresh]);

  useEffect(() => () => clearTimeout(timer.current), []);
}
