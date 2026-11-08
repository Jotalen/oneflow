import type { Analysis } from "@/lib/engine/analyze";

export const analysisCacheKey = (id: string) => `nm:analysis:${id}`;

export interface LoadDeps {
  /** `fresh` asks the server to skip its short cache and read the bank now. */
  fetchProfile: (id: string, fresh?: boolean) => Promise<Analysis>;
  fetchSnapshot: (id: string) => Promise<Analysis | null>;
  readCache: (key: string) => string | null;
  writeCache: (key: string, value: string) => void;
}

export interface LoadResult { data: Analysis | null; offline: boolean; error: string | null }

function readCached(id: string, deps: LoadDeps): Analysis | null {
  try {
    const raw = deps.readCache(analysisCacheKey(id));
    return raw ? (JSON.parse(raw) as Analysis) : null;
  } catch {
    return null; // corrupt or unavailable storage: treat as no cache
  }
}

/** Live profile → cached copy → bundled snapshot (ADR-009). Never returns another persona's data. */
export async function loadAnalysis(id: string, deps: LoadDeps, fresh = false): Promise<LoadResult> {
  try {
    const data = await deps.fetchProfile(id, fresh);
    try { deps.writeCache(analysisCacheKey(id), JSON.stringify(data)); } catch { /* storage full or blocked: cache is optional */ }
    return { data, offline: data.profile.source === "snapshot", error: null };
  } catch (e) {
    const fallback = readCached(id, deps) ?? (await deps.fetchSnapshot(id).catch(() => null));
    if (fallback) return { data: fallback, offline: true, error: null };
    return { data: null, offline: false, error: e instanceof Error ? e.message : "Could not load profile" };
  }
}

/** Browser implementations of the loader's dependencies. */
export const browserLoadDeps: LoadDeps = {
  async fetchProfile(id, fresh) {
    const res = await fetch(`/api/profile/${id}${fresh ? "?fresh=1" : ""}`, { cache: "no-store" });
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? `HTTP ${res.status}`);
    return (await res.json()) as Analysis;
  },
  async fetchSnapshot(id) {
    const res = await fetch(`/snapshots/${id}.json`);
    return res.ok ? ((await res.json()) as Analysis) : null;
  },
  readCache: (key) => localStorage.getItem(key),
  writeCache: (key, value) => localStorage.setItem(key, value),
};
