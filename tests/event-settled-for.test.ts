import { describe, expect, it } from "vitest";
import { settledEventsFor } from "@/lib/events/settled";
import type { EventItem } from "@/lib/events/poller";

const ev = (id: string, type: string, account_id: string | null): EventItem => ({ id, seq: 1, type, created_at: "2026-11-08T14:00:00Z", account_id, tx_id: `tx-${id}` });
const MINE = new Set(["acct-chk", "acct-sav"]);

describe("settledEventsFor", () => {
  it("returns settled events on this customer's accounts", () => {
    // Arrange
    const events = [ev("1", "transaction.completed", "acct-chk"), ev("2", "transaction.declined", "acct-sav")];
    // Act
    const ids = settledEventsFor(events, MINE, new Set());
    // Assert
    expect(ids).toEqual(["1", "2"]);
  });

  it("ignores pending events, so a hold doesn't trigger a reload", () => {
    const events = [ev("1", "transaction.created", "acct-chk"), ev("2", "transaction.pending", "acct-chk")];
    expect(settledEventsFor(events, MINE, new Set())).toEqual([]);
  });

  it("ignores other customers' accounts and events with no account", () => {
    const events = [ev("1", "transaction.completed", "acct-other"), ev("2", "transaction.completed", null)];
    expect(settledEventsFor(events, MINE, new Set())).toEqual([]);
  });

  it("skips events already handled", () => {
    const events = [ev("1", "transaction.completed", "acct-chk"), ev("2", "transaction.cancelled", "acct-chk")];
    expect(settledEventsFor(events, MINE, new Set(["1"]))).toEqual(["2"]);
  });
});
