"use client";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_PREFS, type DashboardPrefs } from "./bubbles";

const KEY = (persona: string) => `nova:dashboard:${persona}`;
const EVT = "nova:dashboard";

function read(persona: string): DashboardPrefs {
  try { const raw = localStorage.getItem(KEY(persona)); return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<DashboardPrefs>) } : DEFAULT_PREFS; } catch { return DEFAULT_PREFS; }
}

/** Per-persona dashboard edits (order, removed, added, auto-pick toggle). */
export function useDashboardPrefs(persona: string) {
  const [prefs, setPrefs] = useState<DashboardPrefs>(DEFAULT_PREFS);
  useEffect(() => {
    setPrefs(read(persona));
    const on = (e: Event) => { if ((e as CustomEvent).detail === persona) setPrefs(read(persona)); };
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, [persona]);
  const save = useCallback((next: DashboardPrefs) => {
    try { localStorage.setItem(KEY(persona), JSON.stringify(next)); } catch { /* storage unavailable */ }
    setPrefs(next);
    window.dispatchEvent(new CustomEvent(EVT, { detail: persona }));
  }, [persona]);
  const reset = useCallback(() => save(DEFAULT_PREFS), [save]);
  return { prefs, save, reset };
}
