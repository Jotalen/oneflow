import { beforeEach, describe, expect, test, vi } from "vitest";
import { NessieError } from "@/lib/nessie/client";

type Tx = { id: string; status: string; account_id: string; decision?: string | null; decision_source?: string | null; amount_cents: number; kind: string };
const pending = (over: Partial<Tx> = {}): Tx => ({ id: "tx1", status: "pending", account_id: "card", decision: null, amount_cents: 80_000, kind: "purchase", ...over });

const getTransaction = vi.fn<(id: string) => Promise<Tx>>();
const decide = vi.fn<(id: string, dto: { decision: string }) => Promise<Tx>>();
const settle = vi.fn<(id: string) => Promise<Tx>>();

vi.mock("@/lib/server/analysis", () => ({
  invalidateAnalysis: () => {},
  knownPersona: (p: string) => p === "C018",
  readSeedIds: () => ({ C018: { cardId: "card" } }),
  getAnalysis: async () => { throw new Error("guard not needed: tests pass an explicit decision"); },
}));
vi.mock("@/lib/nessie/api", () => ({ nessieApi: () => ({ getTransaction, decide, settle, getMerchant: async () => null }) }));

const post = async (body: unknown) => {
  const { POST } = await import("@/app/api/decide/route");
  return POST(new Request("http://x/api/decide", { method: "POST", body: JSON.stringify(body) }));
};

describe("POST /api/decide", () => {
  beforeEach(() => {
    process.env.NESSIE_API_KEY = "test";
    getTransaction.mockReset();
    decide.mockReset();
    settle.mockReset();
  });

  test("settles right after deciding, so a decline releases the hold and an approve completes", async () => {
    // Arrange
    getTransaction.mockResolvedValue(pending());
    decide.mockResolvedValue(pending({ decision: "decline", decision_source: "owner" }));
    settle.mockResolvedValue(pending({ status: "declined", decision: "decline", decision_source: "owner" }));
    // Act
    const res = await post({ persona: "C018", txId: "tx1", decision: "decline" });
    const json = await res.json();
    // Assert
    expect(settle).toHaveBeenCalledWith("tx1");
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ ok: true, decision: "decline", status: "declined" });
  });

  test("when another screen already decided, settles that decision and reports it instead of failing", async () => {
    getTransaction
      .mockResolvedValueOnce(pending())
      .mockResolvedValueOnce(pending({ decision: "approve", decision_source: "owner" }));
    decide.mockRejectedValue(new NessieError(409, "already decided"));
    settle.mockResolvedValue(pending({ status: "completed", decision: "approve" }));
    const res = await post({ persona: "C018", txId: "tx1", decision: "decline" });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ ok: true, decision: "approve", status: "completed", alreadyDecided: true });
  });

  test("a settle conflict (already final) still reports the decision", async () => {
    getTransaction.mockResolvedValueOnce(pending()).mockResolvedValueOnce(pending({ status: "completed", decision: "approve" }));
    decide.mockResolvedValue(pending({ decision: "approve" }));
    settle.mockRejectedValue(new NessieError(409, "not pending"));
    const res = await post({ persona: "C018", txId: "tx1", decision: "approve" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, decision: "approve", status: "completed" });
  });

  test("other bank errors still fail", async () => {
    getTransaction.mockResolvedValue(pending());
    decide.mockRejectedValue(new NessieError(500, "boom"));
    const res = await post({ persona: "C018", txId: "tx1", decision: "approve" });
    expect(res.status).toBe(503);
  });
});
