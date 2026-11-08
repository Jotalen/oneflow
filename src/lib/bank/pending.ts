import type { BankAccount } from "@/lib/engine/types";
import type { Cents } from "@/lib/money";

/**
 * Money held by pending transactions that the bank hasn't settled yet.
 * Cash accounts: balance − available. Cards: credit limit − balance owed − available credit.
 */
export function pendingCents(a: BankAccount): Cents {
  if (a.kind !== "card") return Math.max(0, a.balance - a.available);
  if (!a.creditLimit) return 0;
  return Math.max(0, a.creditLimit - a.balance - a.available);
}
