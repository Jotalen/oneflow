"use client";
import { useEffect, useState } from "react";
import type { RateRow } from "@/lib/toyota/types";

export interface RatesState { rates: RateRow[]; loading: boolean; error: string | null }

/** Toyota rate sheet from GET /api/rates. */
export function useRates(): RatesState {
  const [state, setState] = useState<RatesState>({ rates: [], loading: true, error: null });
  useEffect(() => {
    let alive = true;
    fetch("/api/rates")
      .then(async (r) => {
        const json = (await r.json()) as { rates?: RateRow[]; error?: string };
        if (!r.ok) throw new Error(json.error ?? `HTTP ${r.status}`);
        if (alive) setState({ rates: json.rates ?? [], loading: false, error: null });
      })
      .catch((e: unknown) => { if (alive) setState({ rates: [], loading: false, error: e instanceof Error ? e.message : "rate sheet unavailable" }); });
    return () => { alive = false; };
  }, []);
  return state;
}
