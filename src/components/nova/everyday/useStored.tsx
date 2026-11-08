"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";

const EVENT = "nova:stored";

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener("storage", onChange); };
}

function readRaw(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

/** Per-persona JSON value in localStorage (`nova:<thing>:<personaId>`). Falls back to `initial` if missing, corrupt or storage is unavailable. */
export function useStored<T>(thing: string, personaId: string, initial: T): [T, (next: T) => void] {
  const key = `nova:${thing}:${personaId}`;
  const raw = useSyncExternalStore(subscribe, () => readRaw(key), () => null);
  const value = useMemo<T>(() => {
    if (raw === null) return initial;
    try { return JSON.parse(raw) as T; } catch { return initial; }
    // `initial` is a default only; re-parse when the stored string changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);
  const save = useCallback((next: T) => {
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* storage unavailable: change is not kept */ }
    window.dispatchEvent(new Event(EVENT));
  }, [key]);
  return [value, save];
}
