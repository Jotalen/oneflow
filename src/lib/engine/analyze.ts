import registry from "../../../data/tiles.json";
import type { ToyotaData } from "@/lib/toyota/types";
import { health, type HealthReport } from "./health";
import { bankMoves } from "./moves/bank";
import { carMoves } from "./moves/car";
import { rankMoves, type RankedMove } from "./moves/rank";
import { orderTiles, type TileDef, type TileId } from "@/lib/tiles/order";
import type { Profile } from "./types";

export interface Analysis { profile: Profile; health: HealthReport; ranked: RankedMove[]; tiles: TileId[] }

/** Everything the UI needs for one persona, computed deterministically (ADR-003). */
export function analyze(profile: Profile, toyota: ToyotaData): Analysis {
  return {
    profile,
    health: health(profile),
    ranked: rankMoves(profile, [...carMoves(profile, toyota), ...bankMoves(profile)], toyota),
    tiles: orderTiles(profile, registry as TileDef[]),
  };
}
