import type { EventItem } from "./poller";

/**
 * Nessie v2 announces a new held transaction as `transaction.created` with status "pending"
 * (observed live); `transaction.pending` is also in the spec, so accept both.
 */
export const TERMINAL_EVENT_TYPES = ["transaction.completed", "transaction.declined", "transaction.cancelled"] as const;
export const FEED_EVENT_TYPES = ["transaction.created", "transaction.pending", ...TERMINAL_EVENT_TYPES];

const TERMINAL = new Set<string>(TERMINAL_EVENT_TYPES);

function txStatus(e: EventItem): string | undefined {
  const tx = (e.data as { transaction?: { status?: unknown } } | undefined)?.transaction;
  return typeof tx?.status === "string" ? tx.status : undefined;
}

export function isPendingEvent(e: EventItem): boolean {
  if (e.type === "transaction.pending") return true;
  return e.type === "transaction.created" && txStatus(e) === "pending";
}

export function isTerminalEvent(e: EventItem): boolean {
  return TERMINAL.has(e.type);
}

/** Pending events whose transaction has not reached a terminal state in `events`. */
export function pendingEvents(events: EventItem[]): EventItem[] {
  const settled = new Set(events.filter(isTerminalEvent).map((e) => e.tx_id));
  return events.filter((e) => isPendingEvent(e) && !settled.has(e.tx_id));
}
