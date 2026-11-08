import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createEventPoller, type EventPage } from "@/lib/events/poller";

const ev = (seq: number, type = "transaction.completed") => ({ id: `e${seq}`, seq, type, created_at: "2026-11-07T00:00:00Z", tx_id: `t${seq}` });

describe("createEventPoller", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test("polls every interval, advances the cursor, and de-dupes by seq", async () => {
    const pages: EventPage[] = [
      { items: [ev(1), ev(2)], next_cursor: 2 },
      { items: [ev(2), ev(3)], next_cursor: 3 }, // overlap on purpose
      { items: [], next_cursor: 3 },
    ];
    let i = 0;
    const fetchPage = vi.fn(async (_after: number) => pages[Math.min(i++, pages.length - 1)]);
    const seen: number[] = [];
    const poller = createEventPoller({ fetchPage, intervalMs: 2000, onEvents: (evts) => seen.push(...evts.map((e) => e.seq)) });
    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(2000);
    expect(seen).toEqual([1, 2, 3]);
    expect(fetchPage.mock.calls.map((c) => c[0])).toEqual([0, 2, 3]);
    poller.stop();
  });

  test("on 429 waits Retry-After before the next poll", async () => {
    const err = Object.assign(new Error("rate"), { status: 429, retryAfter: 5 });
    const fetchPage = vi.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue({ items: [], next_cursor: 0 });
    const poller = createEventPoller({ fetchPage, intervalMs: 2000, onEvents: () => {} });
    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(4000);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1100);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    poller.stop();
  });

  test("restarts from after=0 when the server rejects a stale cursor (400)", async () => {
    const bad = Object.assign(new Error("bad cursor"), { status: 400 });
    const fetchPage = vi.fn()
      .mockResolvedValueOnce({ items: [ev(10)], next_cursor: 10 })
      .mockRejectedValueOnce(bad)
      .mockResolvedValue({ items: [], next_cursor: 0 });
    const poller = createEventPoller({ fetchPage, intervalMs: 1000, onEvents: () => {} });
    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchPage.mock.calls.map((c) => c[0])).toEqual([0, 10, 0]);
    poller.stop();
  });

  test("stop() prevents further polls", async () => {
    const fetchPage = vi.fn(async () => ({ items: [], next_cursor: 0 }));
    const poller = createEventPoller({ fetchPage, intervalMs: 1000, onEvents: () => {} });
    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    poller.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});

describe("review fixes — poller catch-up", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test("drains full backlog pages immediately without emitting them, then emits live events", async () => {
    const full = (start: number) => ({ items: Array.from({ length: 3 }, (_, i) => ev(start + i + 1)), next_cursor: start + 3 });
    const fetchPage = vi.fn(async (after: number) => (after < 6 ? full(after) : after === 6 ? { items: [ev(7)], next_cursor: 7 } : { items: [], next_cursor: 7 }));
    const seen: number[] = [];
    const poller = createEventPoller({ fetchPage, intervalMs: 2000, pageSize: 3, skipBacklog: true, onEvents: (e) => seen.push(...e.map((x) => x.seq)) });
    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(10); // catch-up pages come back-to-back, not every 2s
    expect(fetchPage.mock.calls.map((c) => c[0])).toEqual([0, 3, 6]);
    expect(seen).toEqual([7]);
    poller.stop();
  });
});
