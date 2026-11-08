import { address, isAddress, isOffCurveAddress, isSignature } from "@solana/kit";
import { z } from "zod";

export const DEVNET_USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
export const DEVNET_CHAIN_REFERENCE = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
export const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const USDC_DECIMALS = 6;
const U64_MAX = BigInt("18446744073709551615");

export function formatTokenAmount(raw: bigint | string, decimals = USDC_DECIMALS): string {
  const digits = BigInt(raw).toString().padStart(decimals + 1, "0");
  const fraction = digits.slice(-decimals).replace(/0+$/, "");
  return `${digits.slice(0, -decimals)}${fraction ? `.${fraction}` : ""}`;
}

/** Parse exactly: never round a payment or use floating point for token units. */
export function parseUsdcAmount(text: string): bigint {
  const value = text.trim();
  if (!/^\d{1,14}(\.\d{1,6})?$/.test(value)) throw new Error("Enter a USDC amount with up to 6 decimal places.");
  const [whole, fraction = ""] = value.split(".");
  const amount = BigInt(whole) * BigInt(1_000_000) + BigInt(fraction.padEnd(6, "0"));
  if (amount <= BigInt(0) || amount > U64_MAX) throw new Error("Enter a positive USDC amount within the token limit.");
  return amount;
}

const WalletAddress = z.string().refine((value) => isAddress(value) && !isOffCurveAddress(address(value)), "Enter a valid Solana wallet address.");
export const PaymentRequestSchema = z.object({
  sender: WalletAddress,
  recipient: WalletAddress,
  amount: z.string().regex(/^[1-9]\d{0,19}$/).refine((value) => /^[1-9]\d{0,19}$/.test(value) && BigInt(value) <= U64_MAX, "Amount exceeds token limit."),
}).refine((value) => value.sender !== value.recipient, "Choose a different recipient wallet.");
export type PaymentRequest = z.infer<typeof PaymentRequestSchema>;
export const VerifyPaymentSchema = PaymentRequestSchema.safeExtend({
  signature: z.string().refine(isSignature, "Invalid transaction signature."),
  lastValidBlockHeight: z.string().regex(/^\d{1,16}$/),
});
export type VerifyPaymentRequest = z.infer<typeof VerifyPaymentSchema>;
export interface VerifiedPayment extends VerifyPaymentRequest {
  network: "devnet";
  mint: typeof DEVNET_USDC_MINT;
  slot: string;
  networkFee: string;
  blockTime: string | null;
}
export const VerifiedPaymentSchema = VerifyPaymentSchema.safeExtend({
  network: z.literal("devnet"), mint: z.literal(DEVNET_USDC_MINT), slot: z.string().regex(/^\d+$/),
  networkFee: z.string().regex(/^\d+$/), blockTime: z.string().regex(/^\d+$/).nullable(),
});
export const transactionUrl = (signature: string) => `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
