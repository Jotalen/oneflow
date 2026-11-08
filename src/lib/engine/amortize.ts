import type { Cents } from "@/lib/money";

/** Standard amortization. Integer cents in, integer cents out. */
export function amortize(principal: Cents, aprPct: number, termMonths: number): Cents {
  if (termMonths <= 0) return principal;
  if (aprPct === 0) return Math.round(principal / termMonths);
  const r = aprPct / 100 / 12;
  const f = Math.pow(1 + r, termMonths);
  return Math.round((principal * r * f) / (f - 1));
}

/** Balance left after `monthsPaid` payments of `monthlyPayment`. Never below 0. */
export function remainingBalance(principal: Cents, aprPct: number, monthlyPayment: Cents, monthsPaid: number): Cents {
  let bal = principal;
  const r = aprPct / 100 / 12;
  for (let i = 0; i < monthsPaid && bal > 0; i++) {
    bal = Math.round(bal * (1 + r)) - monthlyPayment;
  }
  return Math.max(0, bal);
}

/** One month of interest on a balance, in cents. */
export const monthlyInterest = (balance: Cents, aprPct: number): Cents => Math.round((balance * aprPct) / 100 / 12);
