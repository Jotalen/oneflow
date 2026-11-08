"use client";
import { useCallback } from "react";
import { useStoredValue, writeStored } from "@/lib/bank/storedValue";
import { parseEssentialOverrides } from "@/lib/bank/wealth";
import type { Cents } from "@/lib/money";

/** The customer's own amounts for flexible monthly essentials (cents by essential key). Per persona, in localStorage. */
const KEY = (persona: string) => `nova:essentials:${persona}`;
const EVT = "nova:essentials";
const NONE: Record<string, Cents> = {};

function read(persona: string): Record<string, Cents> {
  try { return parseEssentialOverrides(localStorage.getItem(KEY(persona))); } catch { return NONE; }
}

export function useEssentialOverrides(persona: string) {
  const overrides = useStoredValue(KEY(persona), EVT, parseEssentialOverrides, NONE);
  /** `null` resets the row to OneFlow's estimate. */
  const setOverride = useCallback((key: string, cents: Cents | null) => {
    const rest = Object.fromEntries(Object.entries(read(persona)).filter(([k]) => k !== key));
    writeStored(KEY(persona), EVT, cents === null ? rest : { ...rest, [key]: cents });
  }, [persona]);
  return { overrides, setOverride };
}
