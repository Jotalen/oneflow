"use client";
import { useEffect, useRef, useState } from "react";
import { createEventPoller, type EventItem, type EventPage } from "@/lib/events/poller";
import { FEED_EVENT_TYPES, pendingEvents } from "@/lib/events/pending";
import { mergeNewestFirst } from "@/lib/events/feed";

export const POLL_INTERVAL_MS = 2_000;
const KEEP = 50;
const PAGE_SIZE = 100;

type Listener = (events: EventItem[]) => void;
const listeners = new Set<Listener>();
let shared: ReturnType<typeof createEventPoller> | null = null;

async function fetchPage(after: number): Promise<EventPage> {
  const res = await fetch(`/api/events?after=${after}&limit=${PAGE_SIZE}&types=${FEED_EVENT_TYPES.join(",")}`, { cache: "no-store" });
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
  const mounted = useRef(true);
  useEffect(() => {
    if (!enabled) return;
    mounted.current = true;
    const listener: Listener = (evts) => { if (mounted.current) setEvents((prev) => mergeNewestFirst(prev, evts, KEEP)); };
    listeners.add(listener);
    const p = ensurePoller();
    p.start();
    return () => {
      mounted.current = false;
      listeners.delete(listener);
      if (listeners.size === 0) { p.stop(); shared = null; }
    };
  }, [enabled]);
  const pending = pendingEvents(events);
  // The shared poller runs whenever the feed is enabled and mounted (client-only components).
  return { events, pending, live: enabled };
}
