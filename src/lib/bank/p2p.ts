import { z } from "zod";
import type { Cents } from "@/lib/money";

/** Send money to another NovaBank customer: a real Nessie transfer, checking → their checking. */
export const MAX_P2P_CENTS: Cents = 250_000; // $2,500 per send, like a typical P2P daily cap
export const MAX_MEMO_CHARS = 60;
const MAX_DESCRIPTION_CHARS = 200; // Nessie TransferCreateDTO.description maxLength
const PERSONA_ID_MAX = 10;
const NO_CONTROL_CHARS = /^[^\u0000-\u001f\u007f]*$/;

export const P2PRequest = z
  .object({
    persona: z.string().min(1).max(PERSONA_ID_MAX),
    to: z.string().min(1).max(PERSONA_ID_MAX),
    amountCents: z.number().int().positive().max(MAX_P2P_CENTS, { message: `At most $${MAX_P2P_CENTS / 100} per send` }),
    memo: z.string().trim().max(MAX_MEMO_CHARS).regex(NO_CONTROL_CHARS, { message: "Memo has invalid characters" }).optional(),
  })
  .refine((b) => b.persona !== b.to, { message: "You can't send money to yourself" });
export type P2PRequest = z.infer<typeof P2PRequest>;

export interface P2PReceipt {
  ok: true;
  txId: string;
  /** Nessie's status after we asked it to settle: "completed", or "pending" if it settles on its own. */
  status: string;
  amountCents: Cents;
  recipient: { id: string; name: string };
  memo?: string;
  description: string;
}
export interface P2PFailure { ok: false; error: string; retryAfter?: number }
export type P2PResult = P2PReceipt | P2PFailure;

/** Neutral wording so both the sender's and the recipient's ledgers read correctly. */
export function p2pDescription(fromName: string, toName: string, memo?: string): string {
  const base = `P2P ${fromName} → ${toName}`;
  return (memo ? `${base}: ${memo}` : base).slice(0, MAX_DESCRIPTION_CHARS);
}

export interface Person { id: string; name: string }

/** Everyone the sender can pay: all personas but themselves, by name. */
export function recipientsFor<T extends Person>(people: readonly T[], selfId: string): T[] {
  return people.filter((p) => p.id !== selfId).sort((a, b) => a.name.localeCompare(b.name));
}
