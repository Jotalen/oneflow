import { beforeAll, describe, expect, test, vi } from "vitest";
import { address, generateKeyPairSigner, getBase64Encoder, signTransactionMessageWithSigners, type KeyPairSigner } from "@solana/kit";
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS, getTransferCheckedInstructionDataDecoder } from "@solana-program/token";
import { COMPUTE_BUDGET_PROGRAM_ADDRESS, getSetComputeUnitLimitInstructionDataDecoder, getSetComputeUnitPriceInstructionDataDecoder } from "@solana-program/compute-budget";
import type { SolanaClient } from "@/lib/solana/client";
import { DEVNET_CHAIN_REFERENCE, DEVNET_USDC_MINT, TOKEN_PROGRAM } from "@/lib/solana/payment";
import { preparePayment } from "@/lib/solana/prepare-payment";

let sender: KeyPairSigner;
let recipient: string;
let source: string;
let destination: string;
beforeAll(async () => {
  sender = await generateKeyPairSigner();
  recipient = (await generateKeyPairSigner()).address;
  const mint = address(DEVNET_USDC_MINT);
  source = (await findAssociatedTokenPda({ owner: sender.address, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS }))[0];
  destination = (await findAssociatedTokenPda({ owner: address(recipient), mint, tokenProgram: TOKEN_PROGRAM_ADDRESS }))[0];
});

function mockClient({ existing = false, sol = BigInt(1_000_000_000), tokens = "20000000", genesis = DEVNET_CHAIN_REFERENCE, badRecipient = false } = {}) {
  const method = (value: unknown) => vi.fn(() => ({ send: vi.fn(async () => value) }));
  const rpc = {
    getGenesisHash: method(genesis),
    getAccountInfo: vi.fn((account: string) => ({ send: vi.fn(async () => ({ value: account === source ? {
      owner: TOKEN_PROGRAM, data: { parsed: { info: { owner: sender.address, mint: DEVNET_USDC_MINT, tokenAmount: { amount: tokens, decimals: 6 } } } },
    } : account === destination ? (existing ? { owner: TOKEN_PROGRAM } : null) : badRecipient ? { owner: TOKEN_PROGRAM, executable: false } : null })) })),
    getBalance: method({ value: sol }),
    getLatestBlockhash: method({ value: { blockhash: "11111111111111111111111111111111", lastValidBlockHeight: BigInt(1000) } }),
    getMinimumBalanceForRentExemption: method(BigInt(2_039_280)),
    getFeeForMessage: method({ value: BigInt(5000) }),
  };
  return { client: { rpc } as unknown as SolanaClient, rpc };
}
const request = () => ({ sender: sender.address, recipient, amount: "1000000" });

describe("payment preparation", () => {
  test("builds a checked USDC transfer with a new recipient account and quotes both SOL costs", async () => {
    const { client } = mockClient();
    const prepared = await preparePayment(client, sender, request());
    expect(prepared.message.instructions).toHaveLength(4);
    const instruction = prepared.message.instructions[3];
    expect(instruction.programAddress).toBe(TOKEN_PROGRAM_ADDRESS);
    expect(getTransferCheckedInstructionDataDecoder().decode(instruction.data)).toMatchObject({ amount: BigInt(1_000_000), decimals: 6 });
    expect(instruction.accounts[0].address).toBe(source);
    expect(instruction.accounts[2].address).toBe(destination);
    expect(instruction.accounts[1].address).toBe(DEVNET_USDC_MINT);
    expect(prepared).toMatchObject({ createsAccount: true, networkFee: BigInt(5000), rent: BigInt(2_039_280), remainingUsdc: BigInt(19_000_000) });
  });
  test("does not charge account creation when the recipient already has an ATA", async () => {
    const { client, rpc } = mockClient({ existing: true });
    const prepared = await preparePayment(client, sender, request());
    expect(prepared.message.instructions).toHaveLength(3);
    expect(prepared.rent).toBe(BigInt(0));
    expect(rpc.getMinimumBalanceForRentExemption).not.toHaveBeenCalled();
  });
  test("includes explicit fee instructions before quoting, preventing Phantom's automatic fee insertion", async () => {
    const { client, rpc } = mockClient();
    const prepared = await preparePayment(client, sender, request());
    const [limit, price] = prepared.message.instructions;
    expect(limit.programAddress).toBe(COMPUTE_BUDGET_PROGRAM_ADDRESS);
    expect(price.programAddress).toBe(COMPUTE_BUDGET_PROGRAM_ADDRESS);
    expect(getSetComputeUnitLimitInstructionDataDecoder().decode(limit.data).units).toBe(200_000);
    expect(getSetComputeUnitPriceInstructionDataDecoder().decode(price.data).microLamports).toBe(BigInt(0));
    const [quotedMessage] = rpc.getFeeForMessage.mock.calls[0] as unknown as [string];
    expect(getBase64Encoder().encode(quotedMessage)).toEqual(prepared.messageBytes);
    const signed = await signTransactionMessageWithSigners(prepared.message);
    expect(signed.messageBytes).toEqual(prepared.messageBytes);
  });
  test("rejects insufficient USDC without rounding or changing the requested amount", async () => {
    await expect(preparePayment(mockClient({ tokens: "999999" }).client, sender, request())).rejects.toThrow("Only 0.999999");
  });
  test("requires enough SOL for the network fee plus account creation", async () => {
    await expect(preparePayment(mockClient({ sol: BigInt(5000) }).client, sender, request())).rejects.toThrow("Not enough test SOL");
    await expect(preparePayment(mockClient({ sol: BigInt(5000), existing: true }).client, sender, request())).resolves.toBeDefined();
  });
  test("refuses a non-Devnet RPC before preparing any transfer", async () => {
    const { client, rpc } = mockClient({ genesis: "mainnet" });
    await expect(preparePayment(client, sender, request())).rejects.toThrow("Devnet RPC");
    expect(rpc.getAccountInfo).not.toHaveBeenCalled();
  });
  test("rejects a token account entered as the recipient wallet", async () => {
    await expect(preparePayment(mockClient({ badRecipient: true }).client, sender, request())).rejects.toThrow("wallet address");
  });
  test("rejects an account change between the form and the signing wallet", async () => {
    await expect(preparePayment(mockClient().client, sender, { ...request(), sender: recipient, recipient: sender.address })).rejects.toThrow("wallet account changed");
  });
});
