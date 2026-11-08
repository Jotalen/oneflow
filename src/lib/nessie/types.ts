import { z } from "zod";

/** Response shapes are read leniently (passthrough); we only pin what we use. */
const entity = z.object({ id: z.string() }).passthrough();

export const Customer = entity.extend({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
});
export type Customer = z.infer<typeof Customer>;

export const AccountType = z.enum(["Checking", "Savings", "Credit Card"]);
export const Account = entity.extend({
  type: AccountType,
  nickname: z.string().optional(),
  balance_cents: z.number().int(),
  available_cents: z.number().int().optional(),
  credit_limit_cents: z.number().int().optional().nullable(),
  customer_id: z.string().optional(),
});
export type Account = z.infer<typeof Account>;

export const TransactionStatus = z.enum(["pending", "completed", "declined", "cancelled"]);
export const TransactionKind = z.enum(["deposit", "withdrawal", "transfer", "purchase", "bill_payment", "fee", "interest_credit", "refund", "chargeback"]);
export const Transaction = entity.extend({
  kind: z.string(),
  status: z.string(),
  medium: z.string().optional(),
  amount_cents: z.number().int(),
  description: z.string().optional().nullable(),
  merchant_id: z.string().optional().nullable(),
  bill_id: z.string().optional().nullable(),
  payee_id: z.string().optional().nullable(),
  payer_id: z.string().optional().nullable(),
  parent_transaction_id: z.string().optional().nullable(),
  decision: z.string().optional().nullable(),
  decision_source: z.string().optional().nullable(),
  decision_reason: z.string().optional().nullable(),
  decision_deadline: z.string().optional().nullable(),
  settle_at: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export type Transaction = z.infer<typeof Transaction>;

export const Bill = entity.extend({
  status: z.string(),
  payee: z.string(),
  payment_amount: z.number(),
  nickname: z.string().optional().nullable(),
  recurring_date: z.number().int().optional().nullable(),
  payment_date: z.string().optional().nullable(),
});
export type Bill = z.infer<typeof Bill>;

export const Loan = entity.extend({
  type: z.string(),
  status: z.string(),
  monthly_payment_cents: z.number().int(),
  amount_cents: z.number().int(),
  description: z.string().optional().nullable(),
  account_id: z.string().optional(),
});
export type Loan = z.infer<typeof Loan>;

export const Merchant = entity.extend({ name: z.string().optional() });
export type Merchant = z.infer<typeof Merchant>;

export const Event = z.object({
  id: z.string(),
  seq: z.number().int(),
  type: z.string(),
  created_at: z.string(),
  account_id: z.string().optional().nullable(),
  tx_id: z.string().optional().nullable(),
  data: z.unknown().optional(),
}).passthrough();
export type Event = z.infer<typeof Event>;

export const EventsPage = z.object({ items: z.array(Event), next_cursor: z.number().int() }).passthrough();
export type EventsPage = z.infer<typeof EventsPage>;

export const Simulation = entity.extend({
  mode: z.string(),
  status: z.string(),
  customer_ids: z.array(z.string()).optional().default([]),
  account_ids: z.array(z.string()).optional().default([]),
  merchant_ids: z.array(z.string()).optional().default([]),
  generated: z.number().optional(),
  anomalies: z.number().optional(),
});
export type Simulation = z.infer<typeof Simulation>;

export const list = <T extends z.ZodTypeAny>(item: T) =>
  z.union([z.array(item), z.object({ items: z.array(item) }).passthrough().transform((o) => o.items)]);
