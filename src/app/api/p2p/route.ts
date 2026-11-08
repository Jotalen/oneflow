import { NextResponse } from "next/server";
import { nessieApi } from "@/lib/nessie/api";
import { NessieError } from "@/lib/nessie/client";
import { getAnalysis, invalidateAnalysis, knownPersona, readSeedIds } from "@/lib/server/analysis";
import { personaAccountIds } from "@/lib/engine/ownership";
import { loadToyota } from "@/lib/toyota/load";
import { P2PRequest, p2pDescription, type P2PFailure, type P2PReceipt } from "@/lib/bank/p2p";

/**
 * Send money to another OneFlow customer (P2P). A real Nessie transfer from the sender's checking
 * to the recipient's checking, then settled early so the event feed shows it complete.
 * Never simulates: if the bank is offline nothing is sent and the caller is told so.
 */
const fail = (status: number, error: string, retryAfter?: number) =>
  NextResponse.json<P2PFailure>({ ok: false, error, ...(retryAfter ? { retryAfter } : {}) }, { status });

/** Nessie errors are RFC 9457 problem+json with a stable `type`, e.g. insufficient_funds. */
const problemType = (body: unknown): string => {
  const t = (body as { type?: unknown } | undefined)?.type;
  return typeof t === "string" && t ? t.split("/").pop()!.replaceAll("_", " ") : "rejected";
};

const firstName =(persona: string) => loadToyota().customers.find((c) => c.customer_id === persona)?.first_name ?? persona;

async function settleOrPending(txId: string, createdStatus: string): Promise<string> {
  try {
    return (await nessieApi().settle(txId)).status;
  } catch (e) {
    if (!(e instanceof NessieError) || e.status !== 409) console.warn("[p2p] settle", txId, e instanceof NessieError ? e.status : e);
    return createdStatus; // it still settles on its own when Nessie's pending window closes
  }
}

/** Recipient's account must exist in the bank, be a checking account, and belong to the recipient. */
async function recipientMismatch(accountId: string, customerId: string | undefined): Promise<string | null> {
  const acct = await nessieApi().getAccount(accountId);
  if (acct.type !== "Checking") return "Recipient account is not a checking account";
  if (customerId && acct.customer_id && acct.customer_id !== customerId) return "Recipient account does not belong to the recipient";
  return null;
}

export async function POST(req: Request) {
  const parsed = P2PRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "invalid body");
  const b = parsed.data;
  if (!knownPersona(b.persona)) return fail(404, `unknown persona ${b.persona}`);
  if (!knownPersona(b.to)) return fail(404, `unknown recipient ${b.to}`);
  const toName = firstName(b.to);
  const recipient = readSeedIds()[b.to];
  if (!recipient?.checkingId) return fail(404, `${toName} doesn't have a OneFlow checking account yet`);

  try {
    const { analysis, live, ids } = await getAnalysis(b.persona);
    if (!live || !ids) return fail(503, "The bank is offline, so nothing was sent");
    const src = analysis.profile.accounts.find((a) => a.kind === "checking");
    if (!src) return fail(404, "You don't have a checking account");
    if (src.id !== ids.checkingId) return fail(403, "Checking account does not belong to you");
    if (personaAccountIds(ids).includes(recipient.checkingId)) return fail(400, "You can't send money to yourself");
    if (b.amountCents > src.available) return fail(422, `Only $${(src.available / 100).toFixed(2)} available in checking`);
    const mismatch = await recipientMismatch(recipient.checkingId, recipient.customerId);
    if (mismatch) return fail(409, mismatch);

    const description = p2pDescription(analysis.profile.name, toName, b.memo);
    const tx = await nessieApi().transfer(src.id, { payee_id: recipient.checkingId, amount_cents: b.amountCents, description });
    const status = await settleOrPending(tx.id, tx.status);
    invalidateAnalysis(b.persona, b.to);
    return NextResponse.json<P2PReceipt>({ ok: true, txId: tx.id, status, amountCents: b.amountCents, recipient: { id: b.to, name: toName }, memo: b.memo || undefined, description });
  } catch (e) {
    if (e instanceof NessieError) {
      const status = e.status === 429 ? 429 : e.status === 422 ? 422 : 502;
      return fail(status, status === 422 ? `The bank refused this transfer: ${problemType(e.body)}` : e.message, e.retryAfter);
    }
    console.error("[p2p]", e);
    return fail(500, "internal");
  }
}
