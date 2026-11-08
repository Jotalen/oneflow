"use client";
import { useCallback } from "react";
import { useStoredValue, writeStored } from "@/lib/bank/storedValue";
import { parseOwnedAssets, type OwnedAsset } from "@/lib/bank/wealth";

/** Things the customer owns that the bank can't see, with their own value estimate. Per persona, in localStorage. */
const KEY = (persona: string) => `nova:assets:${persona}`;
const EVT = "nova:assets";
const NONE: OwnedAsset[] = [];

function read(persona: string): OwnedAsset[] {
  try { return parseOwnedAssets(localStorage.getItem(KEY(persona))); } catch { return NONE; }
}

export function useOwnedAssets(persona: string) {
  const assets = useStoredValue(KEY(persona), EVT, parseOwnedAssets, NONE);
  const add = useCallback((a: Omit<OwnedAsset, "id">) => {
    writeStored(KEY(persona), EVT, [...read(persona), { ...a, id: `a${Date.now()}` }]);
  }, [persona]);
  const update = useCallback((id: string, patch: Omit<OwnedAsset, "id">) => {
    writeStored(KEY(persona), EVT, read(persona).map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }, [persona]);
  const remove = useCallback((id: string) => writeStored(KEY(persona), EVT, read(persona).filter((a) => a.id !== id)), [persona]);
  return { assets, add, update, remove };
}
