import fs from "node:fs";
import path from "node:path";

export interface PersonaIds {
  customerId: string;
  checkingId: string;
  savingsId: string;
  cardId: string;
  cdId?: string;
  loanId?: string;
  billIds: string[];
  purchaseCount: number;
  depositCount: number;
}
export interface SeedIds {
  _merchants?: Record<string, string>; // category -> merchant id
  personas: Record<string, Partial<PersonaIds>>;
}

export const SEED_IDS_PATH = path.join(process.cwd(), "data", "seed-ids.json");

export function readSeedIds(): SeedIds {
  if (!fs.existsSync(SEED_IDS_PATH)) return { personas: {} };
  return JSON.parse(fs.readFileSync(SEED_IDS_PATH, "utf8")) as SeedIds;
}

export function writeSeedIds(ids: SeedIds): void {
  fs.mkdirSync(path.dirname(SEED_IDS_PATH), { recursive: true });
  fs.writeFileSync(SEED_IDS_PATH, JSON.stringify(ids, null, 2) + "\n");
}
