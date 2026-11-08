import type { EventItem, EventPage } from "./poller";

/**
 * Server-side shared event buffer (ADR-005 amendment). Every browser tab used to poll Nessie
 * through us, and every fresh tab replayed the whole backlog, spending the 120 req/min budget the
 * profile route needs. Now: one upstream poll at most every `minIntervalMs` (single-flight),
 * a bounded in-memory buffer, and fresh clients (after=0) start at the head with no backlog.
 */
export interface EventCacheOptions {
  fetchPage: (after: number, limit: number) => Promise<EventPage>;
  minIntervalMs: number;
  pageSize: number;
  now?: () => number;
  maxBuffer?: number;
}

const DEFAULT_MAX_BUFFER = 1_000;
const MAX_CATCHUP_PAGES = 40;

export function createEventCache(o: EventCacheOptions) {
  const now = o.now ?? Date.now;
  const maxBuffer = o.maxBuffer ?? DEFAULT_MAX_BUFFER;
  let head: number | null = null;
  let buffer: EventItem[] = [];
  let lastFetch = -Infinity;
  let inflight: Promise<void> | null = null;

  /** Follow full pages until caught up. `keep` = whether to buffer what we read. */
  async function drain(keep: boolean) {
    for (let i = 0; i < MAX_CATCHUP_PAGES; i++) {
      const page = await o.fetchPage(head ?? 0, o.pageSize);
      if (keep && page.items.length) buffer = [...buffer, ...page.items].slice(-maxBuffer);
      head = Math.max(head ?? 0, page.next_cursor);
      if (page.items.length < o.pageSize) return;
    }
  }

  async function refresh() {
    if (inflight) return inflight;
    if (head !== null && now() - lastFetch < o.minIntervalMs) return;
    inflight = drain(head !== null)
      .finally(() => { lastFetch = now(); inflight = null; });
    return inflight;
  }

  return {
    async get(after: number, types?: string[]): Promise<EventPage> {
      await refresh();
      const h = head ?? 0;
      if (!after) return { items: [], next_cursor: h };
      const items = buffer.filter((e) => e.seq > after && (!types?.length || types.includes(e.type)));
      return { items, next_cursor: h };
    },
  };
}
