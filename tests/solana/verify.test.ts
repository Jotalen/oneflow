import { beforeAll, describe, expect, test } from "vitest";
import { address, generateKeyPairSigner, signature } from "@solana/kit";
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { DEVNET_USDC_MINT, TOKEN_PROGRAM, type VerifyPaymentRequest } from "@/lib/solana/payment";
import { verifyConfirmedPayment } from "@/lib/solana/verify-payment";

let request: VerifyPaymentRequest;
let accounts: { source: string; destination: string };
beforeAll(async () => {
  request = { sender: (await generateKeyPairSigner()).address, recipient: (await generateKeyPairSigner()).address, amount: "1000000", signature: signature("1".repeat(64)), lastValidBlockHeight: "1000" };
  const mint = address(DEVNET_USDC_MINT);
  const [source, destination] = await Promise.all([
    findAssociatedTokenPda({ mint, owner: address(request.sender), tokenProgram: TOKEN_PROGRAM_ADDRESS }),
    findAssociatedTokenPda({ mint, owner: address(request.recipient), tokenProgram: TOKEN_PROGRAM_ADDRESS }),
  ]);
  accounts = { source: source[0], destination: destination[0] };
});

function fixture() {
  const balance = (accountIndex: number, owner: string, amount: string) => ({ accountIndex, owner, mint: DEVNET_USDC_MINT, programId: TOKEN_PROGRAM, uiTokenAmount: { amount, decimals: 6 } });
  return {
    slot: BigInt(123), blockTime: BigInt(1794000000),
    meta: { err: null as unknown, fee: BigInt(5000), preTokenBalances: [balance(1, request.sender, "20000000")], postTokenBalances: [balance(1, request.sender, "19000000"), balance(2, request.recipient, "1000000")] },
    transaction: {
      signatures: [request.signature],
      message: {
        accountKeys: [{ pubkey: request.sender, signer: true }, { pubkey: accounts.source, signer: false }, { pubkey: accounts.destination, signer: false }],
        instructions: [{ programId: TOKEN_PROGRAM, parsed: { type: "transferChecked", info: { source: accounts.source, destination: accounts.destination, authority: request.sender, mint: DEVNET_USDC_MINT, tokenAmount: { amount: request.amount, decimals: 6 } } } }],
      },
    },
  };
}

describe("confirmed USDC payment verification", () => {
  test("verifies exact transfer to a newly created recipient token account", () => {
    expect(verifyConfirmedPayment(fixture(), request, accounts)).toMatchObject({ ...request, network: "devnet", slot: "123", networkFee: "5000" });
  });
  test("accepts Kit's bigint decimals in parsed instructions without changing the exact amount", () => {
    const tx = fixture();
    const transfer = tx.transaction.message.instructions[0].parsed;
    const kitTx = { ...tx, transaction: { ...tx.transaction, message: { ...tx.transaction.message, instructions: [{
      programId: TOKEN_PROGRAM,
      parsed: { ...transfer, info: { ...transfer.info, tokenAmount: { amount: request.amount, decimals: BigInt(6) } } },
    }] } } };
    expect(verifyConfirmedPayment(kitTx, request, accounts).amount).toBe("1000000");
    kitTx.transaction.message.instructions[0].parsed.info.tokenAmount.decimals = BigInt(9);
    expect(() => verifyConfirmedPayment(kitTx, request, accounts)).toThrow();
  });
  test("verifies the delta for an already funded recipient", () => {
    const tx = fixture();
    tx.meta.preTokenBalances.push({ ...tx.meta.postTokenBalances[1], uiTokenAmount: { amount: "10000000", decimals: 6 } });
    tx.meta.postTokenBalances[1].uiTokenAmount.amount = "11000000";
    expect(verifyConfirmedPayment(tx, request, accounts).amount).toBe("1000000");
  });
  test("rejects a failed transaction even when its instructions look correct", () => {
    const tx = fixture(); tx.meta.err = { InstructionError: [0, "InsufficientFunds"] };
    expect(() => verifyConfirmedPayment(tx, request, accounts)).toThrow("failed");
  });
  test("rejects a different amount, destination, authority, mint, or program", () => {
    for (const field of ["destination", "authority", "mint"] as const) {
      const tx = fixture(); tx.transaction.message.instructions[0].parsed.info[field] = field === "authority" ? request.recipient : request.sender;
      expect(() => verifyConfirmedPayment(tx, request, accounts)).toThrow();
    }
    const amount = fixture(); amount.transaction.message.instructions[0].parsed.info.tokenAmount.amount = "1";
    expect(() => verifyConfirmedPayment(amount, request, accounts)).toThrow();
    const program = fixture(); program.transaction.message.instructions[0].programId = request.sender;
    expect(() => verifyConfirmedPayment(program, request, accounts)).toThrow();
  });
  test("rejects missing sender approval or a different transaction signature", () => {
    const tx = fixture(); tx.transaction.message.accountKeys[0].signer = false;
    expect(() => verifyConfirmedPayment(tx, request, accounts)).toThrow("sign");
    const other = fixture(); other.transaction.signatures[0] = signature("1".repeat(63) + "2");
    expect(() => verifyConfirmedPayment(other, request, accounts)).toThrow("signature");
  });
  test("requires the recipient's actual USDC credit and sender's actual debit", () => {
    for (const index of [0, 1]) {
      const tx = fixture(); tx.meta.postTokenBalances[index].uiTokenAmount.amount = "20000000";
      expect(() => verifyConfirmedPayment(tx, request, accounts)).toThrow("balance changes");
    }
  });
  test("rejects different token owners, mint decimals, and missing metadata", () => {
    const owner = fixture(); owner.meta.postTokenBalances[1].owner = request.sender;
    expect(() => verifyConfirmedPayment(owner, request, accounts)).toThrow("owner");
    const decimals = fixture(); decimals.meta.postTokenBalances[1].uiTokenAmount.decimals = 9;
    expect(() => verifyConfirmedPayment(decimals, request, accounts)).toThrow();
    expect(() => verifyConfirmedPayment({ ...fixture(), meta: null }, request, accounts)).toThrow("metadata");
  });
});
