import type { Budget } from "@/lib/bank/view";

/** Conservative USD illustration only: 1 test USDC is compared with $1 of demo budget. */
export function previewPaymentBudget(budget: Budget, category: string, tokenUnits: bigint) {
  if (tokenUnits <= BigInt(0)) throw new Error("Payment must be positive.");
  const cents = Number((tokenUnits + BigInt(9_999)) / BigInt(10_000));
  if (!Number.isSafeInteger(cents)) throw new Error("Payment is too large to compare with the demo budget.");
  const selected = budget.categories.find((item) => item.key === category && !item.fixed);
  if (!selected) return null;
  const before = selected.limit - selected.spent;
  const after = before - cents;
  return { cents, category: selected.label, before, after, overBy: Math.max(0, -after), totalAfter: budget.limit - budget.spent - cents };
}
