import { describe, expect, test, vi } from "vitest";

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), connection: async () => {} }));

describe("GET /api/tfs-portfolio", () => {
  test("serves the portfolio built from the pack and the engine", async () => {
    const { GET } = await import("@/app/api/tfs-portfolio/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toHaveLength(20);
    expect(body.totals.customers).toBe(20);
    expect(body.assumptions.length).toBeGreaterThan(0);
  });
});
