import { describe, expect, test, vi } from "vitest";
import { NessieError } from "@/lib/nessie/client";

vi.mock("@/lib/server/analysis", () => ({
  knownPersona: () => true,
  getAnalysis: async () => { throw new NessieError(429, "rate limited", 7); },
}));
vi.mock("@/lib/nessie/api", () => ({ nessieApi: () => ({}) }));

describe("POST /api/execute under Nessie 429", () => {
  test("returns JSON ok:false with retryAfter and status 429, never a bare 500", async () => {
    const { POST } = await import("@/app/api/execute/route");
    const res = await POST(new Request("http://x/api/execute", { method: "POST", body: JSON.stringify({ persona: "C003", moveId: "cancel_recurring" }), headers: { "content-type": "application/json" } }));
    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toMatchObject({ ok: false, retryAfter: 7 });
  });
});
