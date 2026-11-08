/** Run one historical Nessie simulation (ADR-008) and record its account ids. Usage: pnpm simulate */
import fs from "node:fs";
import path from "node:path";
import { createNessieClient } from "@/lib/nessie/client";
import { makeApi } from "@/lib/nessie/api";
import { requireKey } from "./_env";

const OUT = path.join(process.cwd(), "data", "sim-ids.json");
const POLL_MS = 3000;
const MAX_WAIT_MS = 5 * 60_000;

async function main() {
  requireKey();
  const api = makeApi(createNessieClient({ apiKey: process.env.NESSIE_API_KEY!, baseUrl: process.env.NESSIE_BASE_URL }));
  const customersBefore = (await api.listMerchants()).length; // merchants count as a cheap "did it create stuff" probe
  const sim = await api.createSimulation({ mode: "historical", customers: 5, transactions: 2000, anomaly_rate: 0.08, seed: 42 });
  console.log("simulation", sim.id, sim.status);
  const start = Date.now();
  let s = sim;
  while (s.status !== "finished" && s.status !== "stopped") {
    if (Date.now() - start > MAX_WAIT_MS) throw new Error("simulation did not finish in 5 min");
    await new Promise((r) => setTimeout(r, POLL_MS));
    s = await api.getSimulation(sim.id);
    process.stdout.write(`\r  status=${s.status} generated=${s.generated ?? "?"} anomalies=${s.anomalies ?? "?"}   `);
  }
  console.log();
  const merchantsAfter = (await api.listMerchants()).length;
  const out = { simulationId: s.id, status: s.status, customerIds: s.customer_ids, accountIds: s.account_ids, merchantIds: s.merchant_ids, generated: s.generated, anomalies: s.anomalies, merchantsBefore: customersBefore, merchantsAfter, ranAt: new Date().toISOString() };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log(`wrote ${OUT}: ${out.customerIds.length} sim customers, ${out.accountIds.length} accounts, ${out.generated} txns, ${out.anomalies} anomalies`);
}

main().catch((e) => { console.error(e); process.exit(1); });
