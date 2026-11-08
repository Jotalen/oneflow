import { describe, expect, it } from "vitest";
import { mergeNewestFirst } from "@/lib/events/feed";
import type { EventItem } from "@/lib/events/poller";

const ev = (seq: number): EventItem => ({ id: `e${seq}`, seq, type: "transaction.completed", created_at: "2026-11-08T00:00:00Z" });

describe("mergeNewestFirst", () => {
  it("puts the newest incoming events first, ahead of what was already shown", () => {
    expect(mergeNewestFirst([ev(1)], [ev(2), ev(3)], 10).map((e) => e.seq)).toEqual([3, 2, 1]);
  });

  it("does not mutate the incoming batch, so every listener sees the same order", () => {
    const batch = [ev(2), ev(3)];
    mergeNewestFirst([], batch, 10);
    mergeNewestFirst([], batch, 10);
    expect(batch.map((e) => e.seq)).toEqual([2, 3]);
    expect(mergeNewestFirst([], batch, 10).map((e) => e.seq)).toEqual([3, 2]);
  });

  it("keeps at most `keep` events", () => {
    expect(mergeNewestFirst([ev(1), ev(0)], [ev(2)], 2).map((e) => e.seq)).toEqual([2, 1]);
  });
});
