"use client";
import { useEffect, useRef, useState } from "react";
import { createEventPoller, type EventItem, type EventPage } from "@/lib/events/poller";

export const POLL_INTERVAL_MS = 2_000;
const KEEP = 50;
const PAGE_SIZE = 100;
const DEFAULT_TYPES = ["transaction.pending", "transaction.completed", "transaction.declined", "transaction.cancelled"];

type Listener = (events: EventItem[]) => void;
const listeners = new Set<Listener>();
let shared: ReturnType<typeof createEventPoller> | null = null;

async function fetchPage(after: number): Promise<EventPage> {
  const res = await fetch(`/api/events?after=${after}&limit=${PAGE_SIZE}&types=${DEFAULT_TYPES.join(",")}`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error ?? `HTTP ${res.status}`), { status: res.status, retryAfter: body.retryAfter });
  }
  return res.json();
}

function ensurePoller() {
  if (shared) return shared;
  shared = createEventPoller({ fetchPage, intervalMs: POLL_INTERVAL_MS, pageSize: PAGE_SIZE, skipBacklog: true, onEvents: (evts) => listeners.forEach((l) => l(evts)) });
  return shared;
}

/** Module-level singleton poller (one per tab). Components subscribe; last subscriber stops it. */
export function useEventFeed(enabled = true) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [live, setLive] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    if (!enabled) return;
    mounted.current = true;
    const listener: Listener = (evts) => { if (mounted.current) setEvents((prev) => [...evts.reverse(), ...prev].slice(0, KEEP)); };
    listeners.add(listener);
    const p = ensurePoller();
    p.start();
    setLive(true);
    return () => {
      mounted.current = false;
      listeners.delete(listener);
      if (listeners.size === 0) { p.stop(); shared = null; }
    };
  }, [enabled]);
  const pending = events.filter((e) => e.type === "transaction.pending" && !events.some((x) => x.tx_id === e.tx_id && x.type !== "transaction.pending"));
  return { events, pending, live };
}
