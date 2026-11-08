import { describe, expect, it } from "vitest";
import { loadAnalysis, type LoadDeps } from "@/lib/bank/loadAnalysis";
import type { Analysis } from "@/lib/engine/analyze";

const analysis = (id: string, source = "nessie") => ({ profile: { personaId: id, source } }) as unknown as Analysis;

function deps(over: Partial<LoadDeps> = {}): LoadDeps {
  const store = new Map<string, string>();
  return {
    fetchProfile: async (id) => analysis(id),
    fetchSnapshot: async () => null,
    readCache: (k) => store.get(k) ?? null,
    writeCache: (k, v) => { store.set(k, v); },
    ...over,
  };
}

describe("loadAnalysis", () => {
  it("returns live data and caches it", async () => {
    const d = deps();
    const r = await loadAnalysis("C018", d);
    expect(r).toMatchObject({ data: { profile: { personaId: "C018" } }, offline: false, error: null });
    expect(d.readCache("nm:analysis:C018")).toContain("C018");
  });

  it("flags snapshot-sourced data as offline", async () => {
    const r = await loadAnalysis("C003", deps({ fetchProfile: async (id) => analysis(id, "snapshot") }));
    expect(r.offline).toBe(true);
  });

  it("falls back to the cached copy when the API fails", async () => {
    const d = deps({ fetchProfile: async () => { throw new Error("HTTP 503"); } });
    d.writeCache("nm:analysis:C001", JSON.stringify(analysis("C001")));
    const r = await loadAnalysis("C001", d);
    expect(r).toMatchObject({ data: { profile: { personaId: "C001" } }, offline: true, error: null });
  });

  it("falls back to the bundled snapshot when there is no cache", async () => {
    const r = await loadAnalysis("C001", deps({ fetchProfile: async () => { throw new Error("x"); }, fetchSnapshot: async (id) => analysis(id, "snapshot") }));
    expect(r.offline).toBe(true);
    expect(r.data?.profile.personaId).toBe("C001");
  });

  it("returns no data (never another persona's) and an error when everything fails", async () => {
    const r = await loadAnalysis("C009", deps({ fetchProfile: async () => { throw new Error("HTTP 503"); } }));
    expect(r).toEqual({ data: null, offline: false, error: "HTTP 503" });
  });

  it("ignores a corrupt cache entry", async () => {
    const d = deps({ fetchProfile: async () => { throw new Error("down"); } });
    d.writeCache("nm:analysis:C002", "{not json");
    expect((await loadAnalysis("C002", d)).error).toBe("down");
  });
});
