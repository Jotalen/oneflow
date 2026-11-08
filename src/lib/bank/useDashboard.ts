"use client";
import { useCallback } from "react";
import { DEFAULT_PREFS, parseDashboardPrefs, type DashboardPrefs } from "./bubbles";
import { useStoredValue, writeStored } from "./storedValue";

const KEY = (persona: string) => `nova:dashboard:${persona}`;
const EVT = "nova:dashboard";

/** Per-persona dashboard edits (order, removed, added, auto-pick toggle). Overview and Edit read the same key. */
export function useDashboardPrefs(persona: string) {
  const prefs = useStoredValue(KEY(persona), EVT, parseDashboardPrefs, DEFAULT_PREFS);
  const save = useCallback((next: DashboardPrefs) => { if (persona) writeStored(KEY(persona), EVT, next); }, [persona]);
  const reset = useCallback(() => save(DEFAULT_PREFS), [save]);
  return { prefs, save, reset };
}
