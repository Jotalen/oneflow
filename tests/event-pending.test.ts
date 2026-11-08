import { describe, expect, it } from "vitest";
import { FEED_EVENT_TYPES, isPendingEvent, pendingEvents } from "@/lib/events/pending";
import type { EventItem } from "@/lib/events/poller";

const ev = (seq: number, type: string, tx_id: string, status?: string): EventItem => ({
  id: `evt_${seq}`, seq, type, created_at: "2026-11-08T03:30:02Z", tx_id,
  data: status ? { transaction: { id: tx_id, status } } : undefined,
});

describe("pending events", () => {
  it("treats transaction.created with a pending transaction as pending (what Nessie v2 emits)", () => {
    expect(isPendingEvent(ev(1, "transaction.created", "t1", "pending"))).toBe(true);
  });

  it("treats transaction.pending as pending (documented event type)", () => {
    expect(isPendingEvent(ev(1, "transaction.pending", "t1"))).toBe(true);
  });

  it("ignores transaction.created for an already-settled transaction", () => {
    expect(isPendingEvent(ev(1, "transaction.created", "t1", "completed"))).toBe(false);
  });

  it("drops pending txns once a terminal event for the same tx arrives", () => {
    const events = [ev(3, "transaction.completed", "t1"), ev(2, "transaction.created", "t2", "pending"), ev(1, "transaction.created", "t1", "pending")];
    expect(pendingEvents(events).map((e) => e.tx_id)).toEqual(["t2"]);
  });

  it("subscribes the feed to transaction.created", () => {
    expect(FEED_EVENT_TYPES).toContain("transaction.created");
  });
});
