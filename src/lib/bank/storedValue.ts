"use client";
import { useSyncExternalStore } from "react";

interface StorageLike { getItem: (k: string) => string | null }

/**
 * Reads a localStorage value through `parse`, returning the same object until the stored string
 * changes (useSyncExternalStore needs a stable snapshot). Corrupt or blocked storage parses as null.
 */
export function createSnapshotReader(storage: StorageLike | (() => StorageLike)) {
  const cache = new Map<string, { raw: string | null; value: unknown }>();
  const store = typeof storage === "function" ? storage : () => storage;
  return function read<T>(key: string, parse: (raw: string | null) => T): T {
    let raw: string | null = null;
    try { raw = store().getItem(key); } catch { raw = null; }
    const hit = cache.get(key);
    if (hit && hit.raw === raw) return hit.value as T;
    let value: T;
    try { value = parse(raw); } catch { value = parse(null); }
    cache.set(key, { raw, value });
    return value;
  };
}

const readBrowser = createSnapshotReader(() => localStorage);

/** Writes then notifies every useStoredValue reading `key` in this tab. */
export function writeStored(key: string, event: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(event));
}

/** localStorage-backed value; `serverValue` (a stable constant) renders before hydration. */
export function useStoredValue<T>(key: string, event: string, parse: (raw: string | null) => T, serverValue: T): T {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener(event, onChange);
      window.addEventListener("storage", onChange);
      return () => { window.removeEventListener(event, onChange); window.removeEventListener("storage", onChange); };
    },
    () => readBrowser(key, parse),
    () => serverValue,
  );
}
