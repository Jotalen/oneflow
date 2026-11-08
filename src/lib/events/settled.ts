import type { EventItem } from "./poller";
import { isPendingEvent, isTerminalEvent } from "./pending";

/**
 * Ids of bank events on this customer's accounts that change what we show and have not been
 * handled yet: new holds (available drops at once) and settled transactions (completed, declined
 * or cancelled; the balance changes or the hold is released). Any one means the profile should reload.
 */
export function balanceEventsFor(events: readonly EventItem[], accountIds: ReadonlySet<string>, seen: ReadonlySet<string>): string[] {
  return events
    .filter((e) => (isTerminalEvent(e) || isPendingEvent(e)) && !!e.account_id && accountIds.has(e.account_id) && !seen.has(e.id))
    .map((e) => e.id);
}
