import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateKeyPairSigner, signature } from "@solana/kit";
import { DEVNET_CHAIN_REFERENCE, type VerifyPaymentRequest } from "@/lib/solana/payment";

const mocks = vi.hoisted(() => ({ genesis: vi.fn(), tx: vi.fn(), statuses: vi.fn(), height: vi.fn() }));
vi.mock("@solana/kit", async (original) => ({
  ...await original<typeof import("@solana/kit")>(),
  createSolanaRpc: () => ({
    getGenesisHash: () => ({ send: mocks.genesis }),
    getTransaction: () => ({ send: mocks.tx }),
    getSignatureStatuses: () => ({ send: mocks.statuses }),
    getBlockHeight: () => ({ send: mocks.height }),
  }),
}));

let request: VerifyPaymentRequest;
beforeAll(async () => {
  request = { sender: (await generateKeyPairSigner()).address, recipient: (await generateKeyPairSigner()).address, amount: "1000000", signature: signature("1".repeat(64)), lastValidBlockHeight: "1000" };
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.genesis.mockResolvedValue(DEVNET_CHAIN_REFERENCE);
  mocks.tx.mockResolvedValue(null);
  mocks.statuses.mockResolvedValue({ value: [null] });
  mocks.height.mockResolvedValue(BigInt(999));
});
async function post(body: unknown) {
  const { POST } = await import("@/app/api/solana/verify/route");
  return POST(new Request("http://localhost/api/solana/verify", { method: "POST", body: JSON.stringify(body) }));
}

describe("read-only receipt verification API", () => {
  test("rejects malformed payment details without contacting RPC", async () => {
    expect((await post({ ...request, amount: "not-a-number" })).status).toBe(400);
    expect(mocks.genesis).not.toHaveBeenCalled();
  });
  test("returns pending while the transaction can still land", async () => {
    const response = await post(request);
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ pending: true, ok: false });
  });
  test("recognizes an expired unrecorded signature without resubmitting it", async () => {
    mocks.height.mockResolvedValue(BigInt(1001));
    const response = await post(request);
    expect(response.status).toBe(410);
    expect(await response.json()).toMatchObject({ expired: true });
  });
  test("does not call a recorded signature expired when transaction details are delayed", async () => {
    mocks.height.mockResolvedValue(BigInt(1001));
    mocks.statuses.mockResolvedValue({ value: [{ err: null, confirmationStatus: "confirmed" }] });
    expect((await post(request)).status).toBe(202);
  });
  test("reports an on-chain failure", async () => {
    mocks.statuses.mockResolvedValue({ value: [{ err: { InstructionError: [0, "InsufficientFunds"] } }] });
    const response = await post(request);
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ failed: true });
  });
  test("refuses verification against a different chain", async () => {
    mocks.genesis.mockResolvedValue("mainnet");
    expect((await post(request)).status).toBe(503);
    expect(mocks.tx).not.toHaveBeenCalled();
  });
  test("preserves uncertainty on RPC outages rather than claiming failure", async () => {
    mocks.tx.mockRejectedValue(new Error("offline"));
    const response = await post(request);
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ ok: false });
  });
});
