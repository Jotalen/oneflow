import { loadToyota } from "@/lib/toyota/load";
import type { GoldenAnswer, Offer, ValueDriver } from "@/lib/toyota/types";

export interface TfsMeta { offers: Offer[]; golden: GoldenAnswer[]; valueDrivers: ValueDriver[] }

/** Small, static slice of the Toyota pack for the TFS view. */
export function tfsMeta(): TfsMeta {
  const t = loadToyota();
  return { offers: t.offers, golden: t.golden, valueDrivers: t.valueDrivers };
}
