export interface EventItem { id: string; seq: number; type: string; created_at: string; account_id?: string | null; tx_id?: string | null; data?: unknown }
export interface EventPage { items: EventItem[]; next_cursor: number }

export interface PollerOptions {
  fetchPage: (after: number) => Promise<EventPage>;
  intervalMs: number;
  onEvents: (events: EventItem[]) => void;
  onError?: (e: unknown) => void;
  /** Page size requested from the API; a full page means more backlog → poll again immediately. */
  pageSize?: number;
  /** Do not emit events from full backlog pages (history replay); only emit once caught up. */
  skipBacklog?: boolean;
}

const FALLBACK_RETRY_MS = 2_000;
const MAX_BACKOFF_MS = 30_000;

/** One poller per app (ADR-005). De-dupes by seq, honors Retry-After, restarts from 0 on a rejected cursor. */
export function createEventPoller(opts: PollerOptions) {
  let after = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let backoff = FALLBACK_RETRY_MS;
  const seen = new Set<number>();

  const schedule = (ms: number) => {
    if (!running) return;
    timer = setTimeout(tick, ms);
  };

  async function tick() {
    if (!running) return;
    try {
      const page = await opts.fetchPage(after);
      const fresh = page.items.filter((e) => !seen.has(e.seq));
      for (const e of fresh) seen.add(e.seq);
      const full = opts.pageSize !== undefined && page.items.length >= opts.pageSize;
      if (fresh.length && !(full && opts.skipBacklog)) opts.onEvents(fresh);
      after = Math.max(after, page.next_cursor);
      backoff = FALLBACK_RETRY_MS;
      schedule(full ? 0 : opts.intervalMs);
    } catch (e) {
      const err = e as { status?: number; retryAfter?: number };
      opts.onError?.(e);
      if (err.status === 400) { after = 0; schedule(opts.intervalMs); return; }
      const wait = err.status === 429 && err.retryAfter ? err.retryAfter * 1000 : backoff;
      backoff = Math.min(MAX_BACKOFF_MS, backoff * 2);
      schedule(wait);
    }
  }

  return {
    start() { if (running) return; running = true; void tick(); },
    stop() { running = false; if (timer) clearTimeout(timer); timer = null; },
    get cursor() { return after; },
  };
}
