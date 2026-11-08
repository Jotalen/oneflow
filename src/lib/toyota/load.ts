import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import type { ZodType } from "zod";
import {
  GoldenAnswer, Offer, OptionScenario, RateRow, Situation,
  ToyotaContract, ToyotaCustomer, ToyotaVehicle, ValueDriver,
  type ToyotaData,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data", "toyota");

function readCsv<T>(file: string, schema: ZodType<T>): T[] {
  const text = fs.readFileSync(path.join(DATA_DIR, file), "utf8");
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: (h) => h.trim(),
  });
  if (parsed.errors.length) {
    throw new Error(`CSV parse error in ${file}: ${parsed.errors[0].message} (row ${parsed.errors[0].row})`);
  }
  return parsed.data.map((row, i) => {
    const r = schema.safeParse(row);
    if (!r.success) {
      throw new Error(`Invalid row ${i + 2} in ${file}: ${r.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ")}`);
    }
    return r.data;
  });
}

let cache: ToyotaData | null = null;

/** Server-only. Loads and validates the Toyota data pack; money fields in cents. Memoized per process. */
export function loadToyota(): ToyotaData {
  if (cache) return cache;
  cache = {
    customers: readCsv("customers.csv", ToyotaCustomer),
    vehicles: readCsv("vehicles.csv", ToyotaVehicle),
    accounts: readCsv("accounts.csv", ToyotaContract),
    situations: readCsv("situations.csv", Situation),
    options: readCsv("option_scenarios.csv", OptionScenario),
    offers: readCsv("offers_catalog.csv", Offer),
    rates: readCsv("rate_sheet.csv", RateRow),
    valueDrivers: readCsv("value_drivers.csv", ValueDriver),
    golden: readCsv("golden_answers.csv", GoldenAnswer),
  };
  return cache;
}
