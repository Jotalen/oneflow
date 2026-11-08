import { describe, expect, it } from "vitest";
import { pendingCents } from "@/lib/bank/pending";
import type { BankAccount } from "@/lib/engine/types";

const acct = (over: Partial<BankAccount>): BankAccount => ({ id: "a", kind: "checking", nickname: "Checking", balance: 0, available: 0, ...over });

describe("pendingCents", () => {
  it("is the money held on a cash account: balance minus available", () => {
    // Arrange
    const checking = acct({ balance: 1_908_670, available: 1_908_570 });
    // Act / Assert
    expect(pendingCents(checking)).toBe(100);
  });

  it("is 0 when nothing is held", () => {
    expect(pendingCents(acct({ balance: 5_000, available: 5_000 }))).toBe(0);
  });

  it("is the card credit held by pending charges: limit minus balance minus available", () => {
    // Priya's card: $8,000 limit, $6,302.81 owed, $97.19 available → $1,600 in pending holds.
    const card = acct({ kind: "card", creditLimit: 800_000, balance: 630_281, available: 9_719 });
    expect(pendingCents(card)).toBe(160_000);
  });

  it("never goes negative, and a card without a limit has nothing to compare", () => {
    expect(pendingCents(acct({ balance: 100, available: 500 }))).toBe(0);
    expect(pendingCents(acct({ kind: "card", balance: 100, available: 50 }))).toBe(0);
  });
});
