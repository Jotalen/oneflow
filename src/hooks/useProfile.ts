"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Analysis } from "@/lib/engine/analyze";
import { browserLoadDeps, loadAnalysis, type LoadResult } from "@/lib/bank/loadAnalysis";

export interface ProfileState { data: Analysis | null; loading: boolean; offline: boolean; error: string | null; refresh: () => Promise<void> }

interface Loaded extends LoadResult { id: string }

/**
 * Fetch analysis for a persona; fall back to cached copy (ADR-009) with an offline badge.
 * State is keyed by persona id, so a switch never shows the previous customer's data.
 * `enabled` = false waits (e.g. until the browser has resolved which persona is chosen).
 */
export function useProfile(personaId: string, enabled = true): ProfileState {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef(personaId);

  useEffect(() => {
    latest.current = personaId;
    if (!enabled) return;
    let cancelled = false;
    void loadAnalysis(personaId, browserLoadDeps).then((r) => { if (!cancelled) setLoaded({ id: personaId, ...r }); });
    return () => { cancelled = true; };
  }, [personaId, enabled]);

  const refresh = useCallback(async () => {
    const id = personaId;
    setRefreshing(true);
    try {
      // Refreshes follow money moves or new bank events, so always read the bank, not a cache.
      const r = await loadAnalysis(id, browserLoadDeps, true);
      if (latest.current !== id) return;
      // Keep showing the data we have if a background refresh fails.
      setLoaded((prev) => (r.data || prev?.id !== id ? { id, ...r } : prev));
    } finally {
      setRefreshing(false);
    }
  }, [personaId]);

  const mine = loaded?.id === personaId ? loaded : null;
  return { data: mine?.data ?? null, loading: !mine || refreshing, offline: mine?.offline ?? false, error: mine?.error ?? null, refresh };
}
