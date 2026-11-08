import type { EventItem } from "./poller";
import { isTerminalEvent } from "./pending";

/**
 * Ids of settled bank events (completed, declined or cancelled) on this customer's accounts that
 * have not been handled yet. Any one of them means a balance changed, so the profile should reload.
 * Pending events are skipped: a hold alone doesn't trigger a reload.
 */
export function settledEventsFor(events: readonly EventItem[], accountIds: ReadonlySet<string>, seen: ReadonlySet<string>): string[] {
  return events
    .filter((e) => isTerminalEvent(e) && !!e.account_id && accountIds.has(e.account_id) && !seen.has(e.id))
    .map((e) => e.id);
}
