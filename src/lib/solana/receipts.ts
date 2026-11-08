import { z } from "zod";
import { VerifiedPaymentSchema, VerifyPaymentSchema } from "./payment";

export const StoredPaymentSchema = VerifyPaymentSchema.safeExtend({
  status: z.enum(["pending", "verified", "failed"]),
  createdAt: z.string(),
  receipt: VerifiedPaymentSchema.optional(),
  error: z.string().optional(),
  verifiedAt: z.iso.datetime().optional(),
  verificationMs: z.number().int().nonnegative().optional(),
});
export type StoredPayment = z.infer<typeof StoredPaymentSchema>;
export const receiptsKey = (owner: string) => `nova:solana:devnet:receipts:${owner}`;
export const RECEIPTS_EVENT = "oneflow:solana:receipts";

const VerificationReply = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), receipt: VerifiedPaymentSchema }),
  z.object({ ok: z.literal(false), failed: z.boolean().optional(), expired: z.boolean().optional(), error: z.string().optional() }),
]);

/** Resolve a saved signature using server proof; an outage never clears a pending send. */
export function reconcileReceipt(payment: StoredPayment, raw: unknown): StoredPayment {
  const reply = VerificationReply.parse(raw);
  if (reply.ok) {
    const receipt = reply.receipt;
    if (receipt.signature !== payment.signature || receipt.sender !== payment.sender || receipt.recipient !== payment.recipient || receipt.amount !== payment.amount) {
      throw new Error("The verification response did not match this payment.");
    }
    return { ...payment, status: "verified", receipt, error: undefined };
  }
  return { ...payment, status: reply.failed || reply.expired ? "failed" : "pending", error: reply.error };
}

export function readReceipts(storage: Pick<Storage, "getItem">, owner: string): StoredPayment[] {
  try {
    const raw = storage.getItem(receiptsKey(owner));
    if (!raw || raw.length > 200_000) return [];
    const parsed = z.array(StoredPaymentSchema).max(100).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data.filter((receipt) => receipt.sender === owner) : [];
  } catch { return []; }
}

/** One receipt per signature; resolving a pending send never adds another debit. */
export function mergeReceipt(receipts: StoredPayment[], next: StoredPayment): StoredPayment[] {
  return [next, ...receipts.filter((receipt) => receipt.signature !== next.signature)].slice(0, 100);
}
