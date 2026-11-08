import { describe, expect, it } from "vitest";
import { balanceEventsFor } from "@/lib/events/settled";
import type { EventItem } from "@/lib/events/poller";

const ev = (id: string, type: string, account_id: string | null): EventItem => ({ id, seq: 1, type, created_at: "2026-11-08T14:00:00Z", account_id, tx_id: `tx-${id}` });
const MINE = new Set(["acct-chk", "acct-sav"]);

describe("balanceEventsFor", () => {
  it("returns settled events on this customer's accounts", () => {
    // Arrange
    const events = [ev("1", "transaction.completed", "acct-chk"), ev("2", "transaction.declined", "acct-sav")];
    // Act
    const ids = balanceEventsFor(events, MINE, new Set());
    // Assert
    expect(ids).toEqual(["1", "2"]);
  });

  it("also returns new holds, because a hold changes what's available right away", () => {
    const created = { ...ev("1", "transaction.created", "acct-chk"), data: { transaction: { status: "pending" } } };
    const events = [created, ev("2", "transaction.pending", "acct-chk")];
    expect(balanceEventsFor(events, MINE, new Set())).toEqual(["1", "2"]);
  });

  it("ignores other event types", () => {
    expect(balanceEventsFor([ev("1", "account.updated", "acct-chk")], MINE, new Set())).toEqual([]);
  });

  it("ignores other customers' accounts and events with no account", () => {
    const events = [ev("1", "transaction.completed", "acct-other"), ev("2", "transaction.completed", null)];
    expect(balanceEventsFor(events, MINE, new Set())).toEqual([]);
  });

  it("skips events already handled", () => {
    const events = [ev("1", "transaction.completed", "acct-chk"), ev("2", "transaction.cancelled", "acct-chk")];
    expect(balanceEventsFor(events, MINE, new Set(["1"]))).toEqual(["2"]);
  });
});
