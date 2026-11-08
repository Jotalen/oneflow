import { beforeAll, describe, expect, test } from "vitest";
import { generateKeyPairSigner, signature } from "@solana/kit";
import { DEVNET_USDC_MINT, formatTokenAmount, parseUsdcAmount, PaymentRequestSchema } from "@/lib/solana/payment";
import { mergeReceipt, readReceipts, receiptsKey, reconcileReceipt, type StoredPayment } from "@/lib/solana/receipts";

let sender: string;
let recipient: string;
beforeAll(async () => {
  sender = (await generateKeyPairSigner()).address;
  recipient = (await generateKeyPairSigner()).address;
});

describe("USDC payment amounts", () => {
  test("preserves exact token units including the smallest unit and u64 maximum", () => {
    expect(parseUsdcAmount(" 1.000001 ")).toBe(BigInt(1_000_001));
    expect(parseUsdcAmount("0.000001")).toBe(BigInt(1));
    expect(parseUsdcAmount("18446744073709.551615")).toBe(BigInt("18446744073709551615"));
    expect(formatTokenAmount(parseUsdcAmount("20.120000"))).toBe("20.12");
    expect(formatTokenAmount(BigInt(5_000), 9)).toBe("0.000005");
    expect(formatTokenAmount(BigInt(0))).toBe("0");
  });
  test.each(["", "0", "-1", "1e3", "NaN", "1.0000001", "1,000", "18446744073709.551616"])("rejects invalid amount %s without rounding", (amount) => {
    expect(() => parseUsdcAmount(amount)).toThrow();
  });
  test("rejects malformed units, self payments, and invalid wallet addresses without throwing", () => {
    for (const amount of ["NaN", "0", "-1", "1.5", "18446744073709551616"]) expect(PaymentRequestSchema.safeParse({ sender, recipient, amount }).success).toBe(false);
    expect(PaymentRequestSchema.safeParse({ sender, recipient: sender, amount: "1" }).success).toBe(false);
    expect(PaymentRequestSchema.safeParse({ sender, recipient: "0x123", amount: "1" }).success).toBe(false);
    expect(PaymentRequestSchema.safeParse({ sender, recipient, amount: "1" }).success).toBe(true);
  });
});

describe("device payment receipts", () => {
  const sig = signature("1".repeat(64));
  const receipt = (): StoredPayment => ({ sender, recipient, amount: "1000000", signature: sig, lastValidBlockHeight: "100", status: "pending", createdAt: "2026-11-07T00:00:00Z" });
  test("updating the same signature does not create duplicate payment entries", () => {
    const original = receipt();
    const result = mergeReceipt([original], { ...original, status: "failed" });
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("failed");
  });
  test("does not load another wallet's receipts", () => {
    const entries = [receipt(), { ...receipt(), sender: recipient, recipient: sender }];
    const result = readReceipts({ getItem: (key) => key === receiptsKey(sender) ? JSON.stringify(entries) : null }, sender);
    expect(result).toHaveLength(1);
    expect(result[0].sender).toBe(sender);
  });
  test("handles corrupted data and unavailable storage", () => {
    expect(readReceipts({ getItem: () => "invalid json" }, sender)).toEqual([]);
    expect(readReceipts({ getItem: () => { throw new Error("denied"); } }, sender)).toEqual([]);
  });
  test("resolves a saved pending receipt after the server verifies its exact transfer", () => {
    const pending = { ...receipt(), error: "Old verification error" };
    const proof = { ...pending, network: "devnet", mint: DEVNET_USDC_MINT, slot: "123", networkFee: "5000", blockTime: null };
    const resolved = reconcileReceipt(pending, { ok: true, receipt: proof });
    expect(resolved.status).toBe("verified");
    expect(resolved.error).toBeUndefined();
    expect(mergeReceipt([pending], resolved)).toHaveLength(1);
    expect(mergeReceipt([pending], resolved).some((payment) => payment.status === "pending")).toBe(false);
  });
  test("keeps the unresolved receipt when verification cannot reach the network", () => {
    const next = reconcileReceipt(receipt(), { ok: false, error: "RPC unavailable" });
    expect(next.status).toBe("pending");
    expect(next.signature).toBe(sig);
  });
  test.each(["failed", "expired"])("unblocks a signature the server reports as %s", (reason) => {
    expect(reconcileReceipt(receipt(), { ok: false, [reason]: true, error: "Not completed" }).status).toBe("failed");
  });
  test("rejects proof for a different payment instead of clearing the pending receipt", () => {
    const pending = receipt();
    const proof = { ...pending, amount: "2000000", network: "devnet", mint: DEVNET_USDC_MINT, slot: "123", networkFee: "5000", blockTime: null };
    expect(() => reconcileReceipt(pending, { ok: true, receipt: proof })).toThrow("did not match");
    expect(pending.status).toBe("pending");
    expect(() => reconcileReceipt(pending, { ok: true })).toThrow();
  });
});
