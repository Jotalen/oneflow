"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Analysis } from "@/lib/engine/analyze";

const CACHE_KEY = (id: string) => `nm:analysis:${id}`;

export interface ProfileState { data: Analysis | null; loading: boolean; offline: boolean; error: string | null; refresh: () => Promise<void> }

/** Fetch analysis for a persona; fall back to cached copy (ADR-009) with an offline badge. */
export function useProfile(personaId: string): ProfileState {
  const [data, setData] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = useRef(personaId);
  current.current = personaId;

  const refresh = useCallback(async () => {
    const id = personaId;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/profile/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? `HTTP ${res.status}`);
      const json = (await res.json()) as Analysis;
      if (current.current !== id) return;
      setData(json);
      setOffline(json.profile.source === "snapshot");
      try { localStorage.setItem(CACHE_KEY(id), JSON.stringify(json)); } catch { /* ignore */ }
    } catch (e) {
      if (current.current !== id) return;
      let cached: Analysis | null = null;
      try { const raw = localStorage.getItem(CACHE_KEY(id)); cached = raw ? (JSON.parse(raw) as Analysis) : null; } catch { /* ignore */ }
      if (!cached) {
        const snap = await fetch(`/snapshots/${id}.json`).then((r) => (r.ok ? (r.json() as Promise<Analysis>) : null)).catch(() => null);
        cached = snap;
      }
      if (cached) { setData(cached); setOffline(true); } else { setError(e instanceof Error ? e.message : "Could not load profile"); }
    } finally {
      if (current.current === id) setLoading(false);
    }
  }, [personaId]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { data, loading, offline, error, refresh };
}
