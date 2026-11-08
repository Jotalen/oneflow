import { beforeEach, describe, expect, test, vi } from "vitest";

const invalidate = vi.hoisted(() => vi.fn());
import { NessieError } from "@/lib/nessie/client";

type TxFn = (...args: unknown[]) => Promise<{ id: string; status: string; kind: string; amount_cents: number }>;
const transfer = vi.fn<TxFn>(async () => ({ id: "txn_p2p", status: "pending", kind: "transfer", amount_cents: 100 }));
const settle = vi.fn<TxFn>(async () => ({ id: "txn_p2p", status: "completed", kind: "transfer", amount_cents: 100 }));
const getAccount = vi.fn(async (id: string) => ({ id, type: "Checking", balance_cents: 1_000, customer_id: "cust_linda" }));
vi.mock("@/lib/nessie/api", () => ({ nessieApi: () => ({ transfer, settle, getAccount }) }));

const SEED: Record<string, Record<string, unknown>> = {
  C018: { customerId: "cust_brian", checkingId: "chk_brian", savingsId: "sav_brian", cardId: "card_brian", billIds: [] },
  C005: { customerId: "cust_linda", checkingId: "chk_linda", savingsId: "sav_linda", cardId: "card_linda", billIds: [] },
  C009: { customerId: "cust_sofia" }, // seeded customer but no checking account
};
const state = { live: true, checkingId: "chk_brian" };
vi.mock("@/lib/server/analysis", () => ({
  invalidateAnalysis: invalidate,
  knownPersona: (p: string) => ["C018", "C005", "C009", "C010"].includes(p),
  readSeedIds: () => SEED,
  getAnalysis: async () => ({
    live: state.live,
    ids: state.live ? SEED.C018 : undefined,
    analysis: { profile: { name: "Brian", accounts: [
      { id: state.checkingId, kind: "checking", balance: 50_000, available: 40_000 },
      { id: "sav_brian", kind: "savings", balance: 10_000, available: 10_000 },
    ] } },
  }),
}));

const post = async (body: unknown) => {
  const { POST } = await import("@/app/api/p2p/route");
  return POST(new Request("http://x/api/p2p", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));
};
const good = { persona: "C018", to: "C005", amountCents: 100, memo: "Coffee" };

describe("POST /api/p2p", () => {
  beforeEach(() => {
    transfer.mockClear(); settle.mockClear(); getAccount.mockClear();
    state.live = true; state.checkingId = "chk_brian";
  });

  test("sends a real Nessie transfer from the sender's checking to the recipient's checking and settles it", async () => {
    const res = await post(good);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, txId: "txn_p2p", status: "completed", amountCents: 100, recipient: { id: "C005", name: "Linda" }, memo: "Coffee" });
    expect(transfer).toHaveBeenCalledWith("chk_brian", { payee_id: "chk_linda", amount_cents: 100, description: "P2P Brian → Linda: Coffee" });
    expect(settle).toHaveBeenCalledWith("txn_p2p");
    expect(invalidate).toHaveBeenCalledWith("C018", "C005"); // both sides refresh
  });

  test("400 on a malformed body, a self-send, or an absurd amount; nothing moves", async () => {
    expect((await post(null)).status).toBe(400);
    expect((await post({ ...good, to: "C018" })).status).toBe(400);
    expect((await post({ ...good, amountCents: 1.5 })).status).toBe(400);
    expect((await post({ ...good, amountCents: 999_999_999 })).status).toBe(400);
    expect(transfer).not.toHaveBeenCalled();
  });

  test("404 for an unknown sender or recipient", async () => {
    expect((await post({ ...good, persona: "ZZZ" })).status).toBe(404);
    expect((await post({ ...good, to: "C099" })).status).toBe(404);
    expect(transfer).not.toHaveBeenCalled();
  });

  test("404 when the recipient has no OneFlow checking account in the bank", async () => {
    expect((await post({ ...good, to: "C009" })).status).toBe(404);
    expect((await post({ ...good, to: "C010" })).status).toBe(404); // known persona, never seeded
    expect(transfer).not.toHaveBeenCalled();
  });

  test("422 when the amount is more than the sender's available checking balance", async () => {
    const res = await post({ ...good, amountCents: 40_001 });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/400\.00 available/);
    expect(transfer).not.toHaveBeenCalled();
  });

  test("403 when the bank's checking account is not the sender's seeded account", async () => {
    state.checkingId = "chk_someone_else";
    expect((await post(good)).status).toBe(403);
    expect(transfer).not.toHaveBeenCalled();
  });

  test("409 when the recipient's account belongs to a different customer in the bank", async () => {
    getAccount.mockResolvedValueOnce({ id: "chk_linda", type: "Checking", balance_cents: 0, customer_id: "cust_other" });
    expect((await post(good)).status).toBe(409);
    expect(transfer).not.toHaveBeenCalled();
  });

  test("503 and nothing sent when the bank is offline (no fake receipt)", async () => {
    state.live = false;
    const res = await post(good);
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ ok: false });
    expect(transfer).not.toHaveBeenCalled();
  });

  test("reports pending honestly when settle fails", async () => {
    settle.mockRejectedValueOnce(new NessieError(500, "boom"));
    const res = await post(good);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, txId: "txn_p2p", status: "pending" });
  });

  test("passes Nessie's insufficient-funds 422 through as 422", async () => {
    transfer.mockRejectedValueOnce(new NessieError(422, "Nessie 422 on POST /accounts/chk_brian/transfers"));
    expect((await post(good)).status).toBe(422);
  });

  test("429 from Nessie surfaces as 429 with retryAfter", async () => {
    transfer.mockRejectedValueOnce(new NessieError(429, "rate limited", 5));
    const res = await post(good);
    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toMatchObject({ retryAfter: 5 });
  });
});
