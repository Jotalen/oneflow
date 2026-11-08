"use client";
import { useEffect, useState } from "react";
import type { CatalogCar } from "@/lib/bank/borrowing";

export interface CarModelsState { cars: CatalogCar[]; loading: boolean; error: string | null }

/** New Toyota models from GET /api/car-models. */
export function useCarModels(): CarModelsState {
  const [state, setState] = useState<CarModelsState>({ cars: [], loading: true, error: null });
  useEffect(() => {
    let alive = true;
    fetch("/api/car-models")
      .then(async (r) => {
        const json = (await r.json()) as { cars?: CatalogCar[]; error?: string };
        if (!r.ok) throw new Error(json.error ?? `HTTP ${r.status}`);
        if (alive) setState({ cars: json.cars ?? [], loading: false, error: null });
      })
      .catch((e: unknown) => { if (alive) setState({ cars: [], loading: false, error: e instanceof Error ? e.message : "car list unavailable" }); });
    return () => { alive = false; };
  }, []);
  return state;
}
