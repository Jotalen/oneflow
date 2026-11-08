"use client";
import { useEffect, useState } from "react";
import type { Anomaly } from "@/lib/engine/anomaly";
import { Card } from "./ui/Card";

interface FraudBody { available: boolean; reason?: string; customers?: number; accounts?: number; transactions?: number; generatedAnomalies?: number | null; anomalies?: Anomaly[]; counts?: Record<string, number> }
const RULE_LABEL: Record<string, string> = { velocity_spike: "Velocity spike", geo_distant: "Geo-distant", large_transfer_new_payee: "Large transfer, new payee" };

export function FraudTile() {
  const [data, setData] = useState<FraudBody | null>(null);
  useEffect(() => { void fetch("/api/fraud").then((r) => r.json()).then(setData).catch(() => setData({ available: false, reason: "unreachable" })); }, []);
  const title = data?.available ? `${data.anomalies?.length ?? 0} suspicious patterns across the bank today` : "Bank-wide fraud monitor";
  return (
    <Card
      eyebrow="Bank-wide fraud monitor · Nessie simulator"
      title={title}
      right={data?.available ? <span className="chip">{data.customers} simulated customers · {data.transactions} txns</span> : <span className="chip text-muted">{data ? "not available" : "loading"}</span>}
      expandable
      expanded={data?.available && (
        <ul className="space-y-2 text-sm">
          {(data.anomalies ?? []).slice(0, 20).map((a, i) => (
            <li key={i} className="flex flex-wrap gap-2 items-baseline">
              <span className="chip text-warn">{RULE_LABEL[a.rule] ?? a.rule}</span>
              <span>{a.evidence}</span>
              <span className="text-xs font-mono text-muted">acct …{a.accountId.slice(-6)} · {a.txIds.length} tx</span>
            </li>
          ))}
        </ul>
      )}
    >
      {!data ? (
        <p className="text-sm text-muted">Reading simulator accounts…</p>
      ) : !data.available ? (
        <p className="text-sm text-muted">Nessie historical simulation not loaded ({data.reason}). The simulator creates its own synthetic customers; nothing is labeled, so these are our rule detectors, not Nessie&apos;s.</p>
      ) : (
        <div className="flex flex-wrap gap-2 text-sm">
          {Object.entries(data.counts ?? {}).map(([rule, n]) => <span key={rule} className="chip">{RULE_LABEL[rule] ?? rule}: {n}</span>)}
          <span className="text-xs text-muted self-center">Simulator planted {data.generatedAnomalies ?? "?"} anomalies, unlabeled. Rules: 6+ purchases in 10 min · two states within 60 min · ≥ $1,500 to a first-time payee.</span>
        </div>
      )}
    </Card>
  );
}
