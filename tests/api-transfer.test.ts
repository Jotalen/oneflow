import { beforeEach, describe, expect, test, vi } from "vitest";

const invalidate = vi.hoisted(() => vi.fn());

const transfer = vi.fn(async () => ({ id: "txn_1" }));
const settle = vi.fn(async () => ({}));
vi.mock("@/lib/nessie/api", () => ({ nessieApi: () => ({ transfer, settle }) }));
vi.mock("@/lib/server/analysis", () => ({
  invalidateAnalysis: invalidate,
  knownPersona: (p: string) => p === "C018",
  getAnalysis: async () => ({
    live: true,
    ids: { customerId: "c", checkingId: "chk", savingsId: "sav", cardId: "card", billIds: [] },
    analysis: { profile: { accounts: [
      { id: "chk", kind: "checking", balance: 50_000, available: 50_000 },
      { id: "sav", kind: "savings", balance: 10_000, available: 10_000 },
      { id: "card", kind: "card", balance: 20_000, available: 80_000, creditLimit: 100_000 },
    ] } },
  }),
}));

const post = async (body: unknown) => {
  const { POST } = await import("@/app/api/transfer/route");
  return POST(new Request("http://x/api/transfer", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));
};

describe("POST /api/transfer", () => {
  beforeEach(() => { transfer.mockClear(); settle.mockClear(); });

  test("rejects a malformed body with 400", async () => {
    expect((await post({ persona: "C018", from: "checking", to: "checking", amountCents: 100 })).status).toBe(400);
    expect((await post({ persona: "C018", from: "checking", to: "savings", amountCents: -5 })).status).toBe(400);
    expect((await post({ persona: "C018", from: "checking", to: "savings", amountCents: 1.5 })).status).toBe(400);
  });

  test("404 for unknown persona", async () => {
    expect((await post({ persona: "ZZZ", from: "checking", to: "savings", amountCents: 100 })).status).toBe(404);
  });

  test("422 when amount exceeds what the source account has available", async () => {
    const res = await post({ persona: "C018", from: "checking", to: "savings", amountCents: 60_000 });
    expect(res.status).toBe(422);
    expect(transfer).not.toHaveBeenCalled();
  });

  test("paying the card sends a Nessie transfer checking→card and settles it", async () => {
    const res = await post({ persona: "C018", from: "checking", to: "card", amountCents: 20_000, purpose: "Pay card" });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, txIds: ["txn_1"] });
    expect(transfer).toHaveBeenCalledWith("chk", { payee_id: "card", amount_cents: 20_000, description: "Pay card" });
    expect(settle).toHaveBeenCalledWith("txn_1");
    expect(invalidate).toHaveBeenCalledWith("C018"); // next profile read is fresh, not the 15 s cache
  });

  test("paying the card more than its balance is refused", async () => {
    expect((await post({ persona: "C018", from: "checking", to: "card", amountCents: 30_000 })).status).toBe(422);
  });
});
