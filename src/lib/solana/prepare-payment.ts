"use client";

import {
  address, appendTransactionMessageInstructions, compileTransaction, createTransactionMessage,
  getBase64Decoder, pipe, setTransactionMessageFeePayerSigner, setTransactionMessageLifetimeUsingBlockhash,
  type TransactionMessageBytesBase64, type TransactionSigner,
} from "@solana/kit";
import { findAssociatedTokenPda, getCreateAssociatedTokenIdempotentInstruction, getTokenSize, getTransferCheckedInstruction, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { getSetComputeUnitLimitInstruction, getSetComputeUnitPriceInstruction } from "@solana-program/compute-budget";
import { z } from "zod";
import type { SolanaClient } from "./client";
import { DEVNET_CHAIN_REFERENCE, DEVNET_USDC_MINT, formatTokenAmount, PaymentRequestSchema, USDC_DECIMALS, type PaymentRequest } from "./payment";

const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const rpcOptions = () => ({ abortSignal: AbortSignal.timeout(15_000) });

export async function preparePayment(client: SolanaClient, signer: TransactionSigner, input: PaymentRequest) {
  const parsed = PaymentRequestSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid payment details.");
  const request = parsed.data;
  if (signer.address !== request.sender) throw new Error("The wallet account changed. Review the payment again.");
  const genesisHash = await client.rpc.getGenesisHash().send(rpcOptions());
  if (!genesisHash.startsWith(DEVNET_CHAIN_REFERENCE)) throw new Error("This payment requires a Solana Devnet RPC endpoint.");
  const mint = address(DEVNET_USDC_MINT);
  const recipient = address(request.recipient);
  const [source, destination] = await Promise.all([
    findAssociatedTokenPda({ owner: signer.address, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS }),
    findAssociatedTokenPda({ owner: recipient, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS }),
  ]);
  const [sourceInfo, destinationInfo, recipientInfo, solBalance, latest] = await Promise.all([
    client.rpc.getAccountInfo(source[0], { encoding: "jsonParsed", commitment: "confirmed" }).send(rpcOptions()),
    client.rpc.getAccountInfo(destination[0], { encoding: "base64", commitment: "confirmed" }).send(rpcOptions()),
    client.rpc.getAccountInfo(recipient, { encoding: "base64", commitment: "confirmed" }).send(rpcOptions()),
    client.rpc.getBalance(signer.address, { commitment: "confirmed" }).send(rpcOptions()),
    client.rpc.getLatestBlockhash({ commitment: "confirmed" }).send(rpcOptions()),
  ]);
  if (recipientInfo.value && (recipientInfo.value.executable || recipientInfo.value.owner !== SYSTEM_PROGRAM)) {
    throw new Error("Enter the recipient's wallet address, rather than a token account or program address.");
  }
  const data = sourceInfo.value?.data;
  if (!data || !("parsed" in data) || sourceInfo.value?.owner !== TOKEN_PROGRAM_ADDRESS) throw new Error("Your wallet's USDC account has no funds. Request test USDC from the Circle faucet first.");
  const sourceData = z.object({ info: z.object({ mint: z.literal(DEVNET_USDC_MINT), owner: z.literal(request.sender), tokenAmount: z.object({ amount: z.string().regex(/^\d+$/), decimals: z.literal(USDC_DECIMALS) }) }) }).safeParse(data.parsed);
  if (!sourceData.success) throw new Error("The sending account is not a valid Devnet USDC account for this wallet.");
  const sourceAmount = BigInt(sourceData.data.info.tokenAmount.amount);
  const amount = BigInt(request.amount);
  if (amount > sourceAmount) throw new Error(`Only ${formatTokenAmount(sourceAmount)} USDC is available in your sending account.`);
  const createsAccount = destinationInfo.value === null;
  const rent = createsAccount ? await client.rpc.getMinimumBalanceForRentExemption(BigInt(getTokenSize())).send(rpcOptions()) : BigInt(0);
  const instructions = [
    // Include the fee policy in the reviewed message. Otherwise Phantom inserts
    // its own compute-budget instructions during signing, invalidating our quote.
    // Devnet transfers use the base network fee, without a priority surcharge.
    getSetComputeUnitLimitInstruction({ units: 200_000 }),
    getSetComputeUnitPriceInstruction({ microLamports: BigInt(0) }),
    ...(createsAccount ? [getCreateAssociatedTokenIdempotentInstruction({ payer: signer, ata: destination[0], owner: recipient, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS })] : []),
    getTransferCheckedInstruction({ source: source[0], mint, destination: destination[0], authority: signer, amount, decimals: USDC_DECIMALS }),
  ];
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(signer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latest.value, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );
  const messageBytes = compileTransaction(message).messageBytes;
  const fee = await client.rpc.getFeeForMessage(getBase64Decoder().decode(messageBytes) as TransactionMessageBytesBase64, { commitment: "confirmed" }).send(rpcOptions());
  if (fee.value === null) throw new Error("The network couldn't quote this transaction. Please review again.");
  if (solBalance.value < fee.value + rent) throw new Error("Not enough test SOL for network fees and the recipient's token account. Request more from the Solana faucet.");
  return { request, message, messageBytes, networkFee: fee.value, rent, createsAccount, remainingUsdc: sourceAmount - amount, lastValidBlockHeight: latest.value.lastValidBlockHeight.toString() };
}

export type PreparedPayment = Awaited<ReturnType<typeof preparePayment>>;
