"use client";
import { useCallback } from "react";
import { DEFAULT_PREFS, type DashboardPrefs } from "./bubbles";
import { useStoredValue, writeStored } from "./storedValue";

const KEY = (persona: string) => `nova:dashboard:${persona}`;
const EVT = "nova:dashboard";

const parsePrefs = (raw: string | null): DashboardPrefs => (raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<DashboardPrefs>) } : DEFAULT_PREFS);

/** Per-persona dashboard edits (order, removed, added, auto-pick toggle). */
export function useDashboardPrefs(persona: string) {
  const prefs = useStoredValue(KEY(persona), EVT, parsePrefs, DEFAULT_PREFS);
  const save = useCallback((next: DashboardPrefs) => writeStored(KEY(persona), EVT, next), [persona]);
  const reset = useCallback(() => save(DEFAULT_PREFS), [save]);
  return { prefs, save, reset };
}
