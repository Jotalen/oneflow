import { describe, expect, test, vi } from "vitest";

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), connection: async () => {} }));

describe("GET /api/car-models", () => {
  test("serves new Toyotas from the TFS data pack with prices in cents", async () => {
    const { GET } = await import("@/app/api/car-models/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { cars: { id: string; label: string; price: number }[] };
    expect(body.cars.length).toBeGreaterThan(10);
    expect(body.cars.find((c) => c.id === "2024-rav4-le")).toMatchObject({ label: "2024 Toyota RAV4 LE", price: 3_000_000 });
    expect(body.cars.some((c) => c.label.endsWith("Corolla L"))).toBe(false); // the only Used car in the pack
  });
});
