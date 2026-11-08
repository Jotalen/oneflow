import { z } from "zod";
import { DEVNET_USDC_MINT, TOKEN_PROGRAM, USDC_DECIMALS, type VerifiedPayment, type VerifyPaymentRequest } from "./payment";

const Integer = z.union([z.bigint(), z.number().int()]).transform(String);
// Kit preserves arbitrary parsed-instruction integers as bigint, while the
// standard token-balance fields (and raw JSON RPC responses) use numbers.
const UsdcDecimals = z.union([z.literal(USDC_DECIMALS), z.literal(BigInt(USDC_DECIMALS))]).transform(() => USDC_DECIMALS);
const TokenBalance = z.object({
  accountIndex: z.number().int().nonnegative(), mint: z.string(), owner: z.string().optional(), programId: z.string().optional(),
  uiTokenAmount: z.object({ amount: z.string().regex(/^\d+$/), decimals: z.number().int() }),
});
const Transaction = z.object({
  slot: Integer, blockTime: Integer.nullable(),
  meta: z.object({ err: z.unknown(), fee: Integer, preTokenBalances: z.array(TokenBalance), postTokenBalances: z.array(TokenBalance) }),
  transaction: z.object({
    signatures: z.array(z.string()),
    message: z.object({
      accountKeys: z.array(z.object({ pubkey: z.string(), signer: z.boolean() })),
      instructions: z.array(z.object({ programId: z.string(), parsed: z.unknown().optional() })),
    }),
  }),
});
const CheckedTransfer = z.object({
  type: z.literal("transferChecked"),
  info: z.object({
    source: z.string(), destination: z.string(), authority: z.string(), mint: z.literal(DEVNET_USDC_MINT),
    tokenAmount: z.object({ amount: z.string(), decimals: UsdcDecimals }),
  }),
});

/** Read-only proof of this exact transfer, using a confirmed RPC transaction. */
export function verifyConfirmedPayment(raw: unknown, request: VerifyPaymentRequest, accounts: { source: string; destination: string }): VerifiedPayment {
  const result = Transaction.safeParse(raw);
  if (!result.success) throw new Error("Transaction metadata is unavailable or incomplete.");
  const { meta, transaction, slot, blockTime } = result.data;
  if (meta.err !== null) throw new Error("The transaction failed on Solana. No USDC payment was completed.");
  if (transaction.signatures[0] !== request.signature) throw new Error("The transaction signature does not match.");
  const keys = transaction.message.accountKeys;
  if (!keys.some((key) => key.pubkey === request.sender && key.signer)) throw new Error("The sender did not sign this transaction.");
  const transfers = transaction.message.instructions
    .filter((instruction) => instruction.programId === TOKEN_PROGRAM)
    .flatMap((instruction) => { const parsed = CheckedTransfer.safeParse(instruction.parsed); return parsed.success ? [parsed.data.info] : []; });
  if (!transfers.some((info) => info.source === accounts.source && info.destination === accounts.destination && info.authority === request.sender && info.tokenAmount.amount === request.amount)) {
    throw new Error("The confirmed USDC transfer does not match the reviewed recipient and amount.");
  }
  const balance = (entries: z.infer<typeof TokenBalance>[], account: string, owner: string, allowMissing = false) => {
    const index = keys.findIndex((key) => key.pubkey === account);
    const entry = entries.find((item) => item.accountIndex === index);
    if (!entry && allowMissing && index >= 0) return BigInt(0);
    if (!entry || entry.owner !== owner || entry.mint !== DEVNET_USDC_MINT || entry.uiTokenAmount.decimals !== USDC_DECIMALS || entry.programId !== TOKEN_PROGRAM) {
      throw new Error("The token account, owner, or mint does not match the payment.");
    }
    return BigInt(entry.uiTokenAmount.amount);
  };
  const debit = balance(meta.preTokenBalances, accounts.source, request.sender) - balance(meta.postTokenBalances, accounts.source, request.sender);
  const credit = balance(meta.postTokenBalances, accounts.destination, request.recipient) - balance(meta.preTokenBalances, accounts.destination, request.recipient, true);
  if (debit !== BigInt(request.amount) || credit !== BigInt(request.amount)) throw new Error("The confirmed balance changes do not match the payment amount.");
  return { ...request, network: "devnet", mint: DEVNET_USDC_MINT, slot, blockTime, networkFee: meta.fee };
}
