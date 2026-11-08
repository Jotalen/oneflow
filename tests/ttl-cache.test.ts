import { describe, expect, test, vi } from "vitest";
import { createTtlCache } from "@/lib/server/ttl-cache";

describe("createTtlCache", () => {
  test("serves a cached value within the TTL and reloads after it", async () => {
    let t = 0;
    const cache = createTtlCache<number>({ ttlMs: 15_000, now: () => t });
    const load = vi.fn(async () => t);
    expect(await cache.get("C018", load)).toBe(0);
    t = 14_999;
    expect(await cache.get("C018", load)).toBe(0);
    t = 15_000;
    expect(await cache.get("C018", load)).toBe(15_000);
    expect(load).toHaveBeenCalledTimes(2);
  });

  test("concurrent callers share one in-flight load", async () => {
    const cache = createTtlCache<string>({ ttlMs: 15_000 });
    let resolve!: (v: string) => void;
    const load = vi.fn(() => new Promise<string>((r) => { resolve = r; }));
    const a = cache.get("C003", load);
    const b = cache.get("C003", load);
    resolve("fresh");
    expect(await Promise.all([a, b])).toEqual(["fresh", "fresh"]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  test("never caches a failure", async () => {
    const cache = createTtlCache<string>({ ttlMs: 15_000 });
    await expect(cache.get("C001", async () => { throw new Error("429"); })).rejects.toThrow("429");
    expect(await cache.get("C001", async () => "ok")).toBe("ok");
  });

  test("invalidate forces the next get to reload (after a money move)", async () => {
    const cache = createTtlCache<number>({ ttlMs: 15_000 });
    let n = 0;
    const load = async () => ++n;
    await cache.get("C018", load);
    cache.invalidate("C018");
    expect(await cache.get("C018", load)).toBe(2);
  });

  test("an invalidate during an in-flight load is not undone by that stale load", async () => {
    const cache = createTtlCache<string>({ ttlMs: 15_000 });
    let resolve!: (v: string) => void;
    const slow = cache.get("C018", () => new Promise<string>((r) => { resolve = r; }));
    cache.invalidate("C018");
    resolve("stale");
    await slow;
    expect(await cache.get("C018", async () => "fresh")).toBe("fresh");
  });
});
