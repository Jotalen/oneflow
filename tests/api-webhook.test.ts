import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { profileFor } from "./fixtures/profiles";
import { health } from "@/lib/engine/health";

const p = profileFor("C018");
vi.mock("@/lib/server/analysis", () => ({
  readSeedIds: () => ({ C018: { checkingId: "chk", savingsId: "sav", cardId: "card", customerId: "cust", billIds: [] } }),
  getAnalysis: async () => ({ analysis: { profile: p, health: health(p) } }),
}));
vi.mock("@/lib/nessie/api", () => ({ nessieApi: () => ({ getMerchant: async () => ({ id: "m1", name: "Lucky Star", category: "gambling" }) }) }));

const SECRET = "whsec_test";
function signedRequest(body: object, eventId = `evt_${Math.random()}`) {
  const raw = JSON.stringify(body);
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = createHmac("sha256", SECRET).update(`${ts}.${raw}`).digest("hex");
  return new Request("http://x/api/webhook/decision", { method: "POST", body: raw, headers: { "nessie-signature": sig, "nessie-timestamp": ts, "nessie-event-id": eventId } });
}
const purchase = (extra: object = {}) => ({ account_id: "card", transaction: { id: "t1", kind: "purchase", amount_cents: 1_000, payer_id: "card", ...extra } });

describe("/api/webhook/decision", () => {
  beforeEach(() => { vi.resetModules(); process.env.NESSIE_WEBHOOK_SECRET = SECRET; });
  afterEach(() => { delete process.env.NESSIE_WEBHOOK_SECRET; });

  test("refuses to decide when no webhook secret is configured (no unsigned decisions)", async () => {
    delete process.env.NESSIE_WEBHOOK_SECRET;
    const { POST } = await import("@/app/api/webhook/decision/route");
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify(purchase()) }));
    expect(res.status).toBe(503);
  });

  test("rejects a bad signature", async () => {
    const { POST } = await import("@/app/api/webhook/decision/route");
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify(purchase()), headers: { "nessie-signature": "00", "nessie-timestamp": "1" } }));
    expect(res.status).toBe(401);
  });

  test("applies the blocked-category rule using the transaction's merchant", async () => {
    const { POST } = await import("@/app/api/webhook/decision/route");
    const res = await POST(signedRequest(purchase({ merchant_id: "m1" })));
    await expect(res.json()).resolves.toMatchObject({ decision: "decline", rule: "blocked_category" });
  });

  test("GET status does not expose decision reasons (they contain customer balances)", async () => {
    const { POST, GET } = await import("@/app/api/webhook/decision/route");
    await POST(signedRequest(purchase({ amount_cents: 2_000_000_00 })));
    const body = JSON.stringify(await GET().json());
    expect(body).not.toMatch(/\$|reason/);
  });
});
