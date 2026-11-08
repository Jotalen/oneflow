/**
 * Tiny per-key TTL cache with in-flight de-duplication. Failures are never cached.
 * `invalidate` bumps a generation counter so a load that started before it cannot repopulate stale data.
 */
export interface TtlCache<T> {
  get(key: string, load: () => Promise<T>): Promise<T>;
  invalidate(key: string): void;
}

interface Entry<T> { value?: T; at: number; inflight?: Promise<T>; gen: number }

export function createTtlCache<T>(opts: { ttlMs: number; now?: () => number }): TtlCache<T> {
  const now = opts.now ?? Date.now;
  const entries = new Map<string, Entry<T>>();
  const entry = (key: string): Entry<T> => {
    let e = entries.get(key);
    if (!e) { e = { at: -Infinity, gen: 0 }; entries.set(key, e); }
    return e;
  };

  return {
    get(key, load) {
      const e = entry(key);
      if (e.value !== undefined && now() - e.at < opts.ttlMs) return Promise.resolve(e.value);
      if (e.inflight) return e.inflight;
      const gen = e.gen;
      const p = load().then(
        (value) => {
          if (e.gen === gen) { e.value = value; e.at = now(); }
          if (e.inflight === p) e.inflight = undefined;
          return value;
        },
        (err: unknown) => {
          if (e.inflight === p) e.inflight = undefined;
          throw err;
        },
      );
      e.inflight = p;
      return p;
    },
    invalidate(key) {
      const e = entry(key);
      e.gen += 1;
      e.value = undefined;
      e.inflight = undefined;
    },
  };
}
