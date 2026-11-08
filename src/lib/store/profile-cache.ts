import type { Profile } from "@/lib/engine/types";

/** Browser-only cache (ADR-004/009). Every call is try/catch: storage may be unavailable. */
const KEY = (id: string) => `nm:profile:${id}`;

export function saveProfile(p: Profile): void {
  try {
    localStorage.setItem(KEY(p.personaId), JSON.stringify(p));
  } catch {
    /* storage unavailable; ignore */
  }
}

export function loadCachedProfile(personaId: string): Profile | null {
  try {
    const raw = localStorage.getItem(KEY(personaId));
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

export async function loadSnapshot(personaId: string): Promise<Profile | null> {
  try {
    const res = await fetch(`/snapshots/${personaId}.json`, { cache: "force-cache" });
    if (!res.ok) return null;
    const p = (await res.json()) as Profile;
    return { ...p, source: "snapshot" };
  } catch {
    return null;
  }
}
