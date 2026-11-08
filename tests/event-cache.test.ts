import { describe, expect, test, vi } from "vitest";
import { createEventCache } from "@/lib/events/cache";
import type { EventItem } from "@/lib/events/poller";

const ev = (seq: number, type = "transaction.completed"): EventItem => ({ id: `e${seq}`, seq, type, created_at: "" });

function upstream(total: number) {
  let head = total;
  const calls: number[] = [];
  const fetchPage = vi.fn(async (after: number, limit: number) => {
    calls.push(after);
    const items = Array.from({ length: Math.max(0, Math.min(limit, head - after)) }, (_, i) => ev(after + i + 1));
    return { items, next_cursor: items.length ? items[items.length - 1].seq : after };
  });
  return { fetchPage, calls, push: (n: number) => { head += n; } };
}

describe("event cache", () => {
  test("a fresh client (after=0) gets the head cursor and no backlog", async () => {
    const u = upstream(1234);
    let now = 0;
    const c = createEventCache({ fetchPage: u.fetchPage, minIntervalMs: 2000, pageSize: 500, now: () => now });
    const page = await c.get(0);
    expect(page.items).toEqual([]);
    expect(page.next_cursor).toBe(1234);
  });

  test("clients share one upstream poll inside the interval", async () => {
    const u = upstream(10);
    let now = 0;
    const c = createEventCache({ fetchPage: u.fetchPage, minIntervalMs: 2000, pageSize: 500, now: () => now });
    await c.get(0);
    const before = u.fetchPage.mock.calls.length;
    await Promise.all([c.get(10), c.get(10), c.get(10)]);
    expect(u.fetchPage.mock.calls.length).toBe(before);
    now = 2500;
    u.push(2);
    await Promise.all([c.get(10), c.get(10)]);
    expect(u.fetchPage.mock.calls.length).toBe(before + 1);
  });

  test("returns buffered events after the client's cursor, filtered by type", async () => {
    const u = upstream(10);
    let now = 0;
    const c = createEventCache({ fetchPage: u.fetchPage, minIntervalMs: 2000, pageSize: 500, now: () => now });
    await c.get(0);
    u.push(3);
    now = 3000;
    const page = await c.get(11);
    expect(page.items.map((e) => e.seq)).toEqual([12, 13]);
    expect(page.next_cursor).toBe(13);
    const none = await c.get(11, ["transaction.pending"]);
    expect(none.items).toEqual([]);
  });
});
