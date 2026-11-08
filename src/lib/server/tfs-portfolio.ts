import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { analyze } from "@/lib/engine/analyze";
import type { Profile } from "@/lib/engine/types";
import { buildPortfolio, type Portfolio, type PortfolioInput } from "@/lib/tfs/portfolio";
import { loadToyota } from "@/lib/toyota/load";
import { syntheticProfile } from "./analysis";

const SNAPSHOT_DIR = path.join(process.cwd(), "public", "snapshots");
const PERSONA_ID = /^C\d{3}$/;

/** Minimal shape check: enough to trust the file is this customer's Profile. */
const SnapshotFile = z.looseObject({
  profile: z.looseObject({ personaId: z.string(), name: z.string(), carOptions: z.array(z.unknown()), flags: z.looseObject({}) }),
});

/** The bank state each customer's app falls back to (ADR-009). Null when missing or malformed. */
export function snapshotProfile(id: string): Profile | null {
  if (!PERSONA_ID.test(id)) return null;
  const file = path.join(SNAPSHOT_DIR, `${id}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = SnapshotFile.safeParse(JSON.parse(fs.readFileSync(file, "utf8")));
    if (!parsed.success || parsed.data.profile.personaId !== id) {
      console.warn(`[tfs-portfolio] snapshot ${id} malformed; using synthetic bank`);
      return null;
    }
    return parsed.data.profile as unknown as Profile;
  } catch (e) {
    console.warn(`[tfs-portfolio] snapshot ${id} unreadable; using synthetic bank`, e);
    return null;
  }
}

/**
 * One engine run per TFS customer, with no live Nessie calls (shared, rate-limited).
 * Bank state: the bundled snapshot, else the synthetic plan the seed script executes.
 * The engine (analyze → rankMoves) runs fresh, so badges match the current release.
 */
export function portfolioInputs(): PortfolioInput[] {
  const t = loadToyota();
  return t.customers.map(({ customer_id: id }) => {
    const snap = snapshotProfile(id);
    const profile = snap ?? syntheticProfile(id);
    return { profile, ranked: analyze(profile, t).ranked, source: snap ? "snapshot" : "synthetic" };
  });
}

export function tfsPortfolio(): Portfolio {
  return buildPortfolio(portfolioInputs(), loadToyota());
}
