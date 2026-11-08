import { describe, expect, test } from "vitest";
import { personaIndex, toEventRow } from "@/lib/tiger/events";
import type { EventItem } from "@/lib/events/poller";

const index = personaIndex({ C018: { checkingId: "chk", savingsId: "sav", cardId: "card" }, C003: { checkingId: "p_chk" } });

describe("personaIndex", () => {
  test("maps every seeded account id to its persona", () => {
    expect(index.get("card")).toBe("C018");
    expect(index.get("p_chk")).toBe("C003");
    expect(index.get("unknown")).toBeUndefined();
  });
});

describe("toEventRow", () => {
  test("reads amount, status and decision from a transaction event", () => {
    const e: EventItem = { id: "e1", seq: 2485, type: "transaction.declined", created_at: "2026-11-08T03:59:00Z", account_id: "card", tx_id: "t1",
      data: { transaction: { kind: "purchase", status: "declined", amount_cents: 80_000, decision: "decline", decision_source: "owner" } } };
    expect(toEventRow(e, index)).toEqual({ seq: 2485, createdAt: "2026-11-08T03:59:00Z", type: "transaction.declined", accountId: "card", txId: "t1", personaId: "C018",
      kind: "purchase", status: "declined", amountCents: 80_000, balanceCents: null, deltaCents: null, decision: "decline", decisionSource: "owner" });
  });

  test("reads the new balance from account.balance_changed", () => {
    const e: EventItem = { id: "e2", seq: 2471, type: "account.balance_changed", created_at: "2026-11-08T03:32:51Z", account_id: "card", tx_id: "t2",
      data: { account_id: "card", balance_cents: 483_526, delta_cents: 30_000, kind: "purchase" } };
    expect(toEventRow(e, index)).toMatchObject({ personaId: "C018", kind: "purchase", balanceCents: 483_526, deltaCents: 30_000, amountCents: null, status: null });
  });

  test("keeps events for accounts outside our personas, with no persona", () => {
    const e: EventItem = { id: "e3", seq: 9, type: "transaction.completed", created_at: "2026-11-08T00:00:00Z", account_id: "sim_acct", tx_id: "t3", data: { transaction: { amount_cents: "oops" } } };
    expect(toEventRow(e, index)).toMatchObject({ personaId: null, amountCents: null });
  });
});
