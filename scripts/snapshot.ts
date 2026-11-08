/**
 * Write one Analysis per persona to data/snapshots and public/snapshots (ADR-009).
 * Uses live Nessie when seeded + key; otherwise the synthetic plan. Usage: pnpm snapshot
 */
import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "./_env";
import { loadToyota } from "@/lib/toyota/load";
import { getAnalysis } from "@/lib/server/analysis";

async function main() {
  loadEnv();
  const t = loadToyota();
  const outDirs = ["data/snapshots", "public/snapshots"].map((d) => path.join(process.cwd(), d));
  for (const d of outDirs) fs.mkdirSync(d, { recursive: true });
  let live = 0;
  for (const c of t.customers) {
    const id = c.customer_id;
    try {
      const { analysis, live: isLive } = await getAnalysis(id);
      if (isLive) live++;
      const json = JSON.stringify({ ...analysis, profile: { ...analysis.profile, source: "snapshot" } });
      for (const d of outDirs) fs.writeFileSync(path.join(d, `${id}.json`), json);
      process.stdout.write(`${id}${isLive ? "*" : ""} `);
    } catch (e) {
      console.warn(`\n${id}: ${(e as Error).message}`);
    }
  }
  console.log(`\nwrote ${t.customers.length} snapshots (${live} from live Nessie, * = live)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
