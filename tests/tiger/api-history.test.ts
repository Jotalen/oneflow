import { beforeEach, describe, expect, test, vi } from "vitest";

const readBalanceBuckets = vi.fn(async () => [
  { bucket: "2026-11-08T00:45:00.000Z", accountId: "chk", balanceCents: 1_000 },
  { bucket: "2026-11-08T01:00:00.000Z", accountId: "card", balanceCents: 300 },
]);
const readActivity = vi.fn(async () => ({ events: 5, holds: 2, declined: 1, firstAt: "2026-11-08T00:45:00.000Z", lastAt: "2026-11-08T01:00:00.000Z" }));
vi.mock("@/lib/tiger/store", () => ({ readBalanceBuckets, readActivity }));
vi.mock("@/lib/server/analysis", () => ({
  invalidateAnalysis: () => {},
  knownPersona: (p: string) => p === "C018",
  readSeedIds: () => ({ C018: { checkingId: "chk", savingsId: "sav", cardId: "card" } }),
}));

const get = async (persona: string) => {
  const { GET } = await import("@/app/api/history/[persona]/route");
  return GET(new Request(`http://x/api/history/${persona}`), { params: Promise.resolve({ persona }) });
};

describe("GET /api/history/[persona]", () => {
  beforeEach(() => { process.env.DATABASE_URL = "postgres://x"; readBalanceBuckets.mockClear(); });

  test("returns the balance series and activity from Tiger Data", async () => {
    const res = await get("C018");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true, source: "tiger",
      points: [{ t: "2026-11-08T00:45:00.000Z", cash: 1_000, cardOwed: 0 }, { t: "2026-11-08T01:00:00.000Z", cash: 1_000, cardOwed: 300 }],
      activity: { events: 5, holds: 2, declined: 1, firstAt: "2026-11-08T00:45:00.000Z", lastAt: "2026-11-08T01:00:00.000Z" },
    });
  });

  test("404 for an unknown persona", async () => {
    expect((await get("C999")).status).toBe(404);
  });

  test("says it is not configured (no fake data) when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    const res = await get("C018");
    await expect(res.json()).resolves.toEqual({ ok: false, configured: false });
    expect(readBalanceBuckets).not.toHaveBeenCalled();
  });
});
