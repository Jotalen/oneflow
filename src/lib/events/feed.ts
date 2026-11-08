import type { EventItem } from "./poller";

/** Newest-first feed: incoming batch (oldest→newest) goes in front of `prev`. Never mutates inputs. */
export function mergeNewestFirst(prev: EventItem[], incoming: EventItem[], keep: number): EventItem[] {
  return [...incoming].reverse().concat(prev).slice(0, keep);
}
