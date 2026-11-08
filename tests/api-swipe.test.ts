import { beforeEach, describe, expect, test, vi } from "vitest";

const merchants: { id: string; name: string; category: string }[] = [];
const createMerchant = vi.fn(async (dto: { name: string; category: string }) => {
  const m = { id: `m${merchants.length + 1}`, ...dto };
  merchants.push(m);
  return m;
});
const purchase = vi.fn(async (_card: string, dto: { merchant_id: string; amount_cents: number }) => ({ id: "tx1", status: "pending", settle_at: "soon", ...dto }));

vi.mock("@/lib/server/analysis", () => ({
  invalidateAnalysis: () => {},
  knownPersona: (p: string) => p === "C018",
  readSeedIds: () => ({ C018: { cardId: "card" } }),
}));
vi.mock("@/lib/nessie/api", () => ({ nessieApi: () => ({ listMerchants: async () => [...merchants], createMerchant, purchase }) }));

const post = async (body: unknown) => {
  const { POST } = await import("@/app/api/dev/swipe/route");
  return POST(new Request("http://x/api/dev/swipe", { method: "POST", body: JSON.stringify(body) }));
};

describe("POST /api/dev/swipe", () => {
  beforeEach(() => {
    process.env.NESSIE_API_KEY = "test";
    merchants.splice(0, merchants.length, { id: "target", name: "Target", category: "retail" });
    createMerchant.mockClear();
    purchase.mockClear();
  });

  test("defaults to an $800 retail swipe", async () => {
    const res = await post({ persona: "C018" });
    expect(res.status).toBe(200);
    expect(purchase).toHaveBeenCalledWith("card", expect.objectContaining({ merchant_id: "target", amount_cents: 80_000 }));
  });

  test("creates a real casino merchant (category gambling) the first time, then reuses it", async () => {
    await post({ persona: "C018", merchantCategory: "gambling" });
    await post({ persona: "C018", merchantCategory: "gambling" });
    expect(createMerchant).toHaveBeenCalledTimes(1);
    expect(createMerchant.mock.calls[0][0]).toMatchObject({ category: "gambling" });
    expect(purchase).toHaveBeenLastCalledWith("card", expect.objectContaining({ merchant_id: "m2" }));
  });

  test("rejects categories outside the demo allow-list and absurd amounts", async () => {
    expect((await post({ persona: "C018", merchantCategory: "crypto-anything" })).status).toBe(400);
    expect((await post({ persona: "C018", amountCents: -5 })).status).toBe(400);
    expect((await post({ persona: "C018", amountCents: 10_000_000 })).status).toBe(400);
    expect(createMerchant).not.toHaveBeenCalled();
    expect(purchase).not.toHaveBeenCalled();
  });
});
