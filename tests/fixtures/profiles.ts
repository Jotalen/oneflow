import { buildProfile } from "@/lib/engine/normalize";
import type { NessieBundle, Profile } from "@/lib/engine/types";
import { loadToyota } from "@/lib/toyota/load";

export const toyota = loadToyota();

/** Typical bank bundle: modest checking, some savings, a card with a balance, subscriptions. */
export function typicalBundle(): NessieBundle {
  return {
    customer: { id: "c", first_name: "X", last_name: "Y" },
    accounts: [
      { id: "chk", type: "Checking", nickname: "Everyday Checking", balance_cents: 300_000, available_cents: 300_000 },
      { id: "sav", type: "Savings", nickname: "Rainy Day Savings", balance_cents: 500_000, available_cents: 500_000 },
      { id: "card", type: "Credit Card", nickname: "Rewards Card", balance_cents: 150_000, available_cents: 350_000, credit_limit_cents: 500_000 },
    ],
    transactionsByAccount: {
      chk: Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, kind: "purchase", status: "completed", amount_cents: 6_000, merchant_id: "m", description: "Tom Thumb" })),
    },
    bills: [
      { id: "b1", status: "recurring", payee: "Netflix", payment_amount: 15.99, recurring_date: 3 },
      { id: "b2", status: "recurring", payee: "T-Mobile", payment_amount: 85, recurring_date: 20 },
      { id: "b3", status: "recurring", payee: "Other Lender", payment_amount: 450, recurring_date: 1 },
    ],
    loans: [],
  };
}

/** Broke bundle: zero liquid cash, maxed card. */
export function brokeBundle(): NessieBundle {
  const b = typicalBundle();
  b.accounts = [
    { id: "chk", type: "Checking", nickname: "Everyday Checking", balance_cents: 0, available_cents: 0 },
    { id: "card", type: "Credit Card", nickname: "Rewards Card", balance_cents: 100_000, available_cents: 0, credit_limit_cents: 100_000 },
  ];
  return b;
}

export const profileFor = (personaId: string, bundle: NessieBundle = typicalBundle()): Profile => buildProfile(bundle, toyota, personaId);
