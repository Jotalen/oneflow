"use client";
import { useEffect, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtAxisK, fmtUSD, type Cents } from "@/lib/money";
import type { BalancePoint } from "@/lib/tiger/history";
import type { ActivityStats } from "@/lib/tiger/store";
import { Panel, Tile } from "./ui";

type HistoryResponse =
  | { ok: true; source: "tiger"; points: BalancePoint[]; activity: ActivityStats }
  | { ok: false; configured: boolean; error?: string };

interface Loaded { persona: string; res: HistoryResponse | null; failed: boolean }

const CHART_HEIGHT = 200;
const axisTick = { fontSize: 11, fill: "var(--muted)" };
const timeLabel = (t: string | number) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/**
 * Balance history from Tiger Data: every Nessie balance change lands in a TimescaleDB hypertable,
 * and a 15-minute continuous aggregate feeds this chart. Hidden when Tiger isn't configured.
 */
export function BalanceHistory({ personaId }: { personaId: string }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/history/${personaId}`, { cache: "no-store" })
      .then((r) => r.json() as Promise<HistoryResponse>)
      .then((res) => { if (!cancelled) setLoaded({ persona: personaId, res, failed: false }); })
      .catch(() => { if (!cancelled) setLoaded({ persona: personaId, res: null, failed: true }); });
    return () => { cancelled = true; };
  }, [personaId]);

  const mine = loaded?.persona === personaId ? loaded : null;
  if (mine?.res && !mine.res.ok && !mine.res.configured) return null;
  const title = "Balance history";
  const subtitle = "Every balance change from the bank, stored in Tiger Data (TimescaleDB)";
  if (!mine) return <Panel title={title} subtitle={subtitle}><p className="text-sm text-muted">Loading history…</p></Panel>;
  if (mine.failed || !mine.res?.ok) {
    const msg = (mine.res && !mine.res.ok && mine.res.error) || "Balance history is unavailable right now.";
    return <Panel title={title} subtitle={subtitle}><p className="text-sm text-muted">{msg}</p></Panel>;
  }

  const { activity } = mine.res;
  // Numeric time axis so uneven gaps between buckets are drawn to scale.
  const points = mine.res.points.map((p) => ({ ...p, ms: Date.parse(p.t) }));
  const last = points[points.length - 1];
  return (
    <Panel title={title} subtitle={subtitle}>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mb-3">
        <Tile label="Bank events stored" value={activity.events.toLocaleString()} />
        <Tile label="Transactions posted" value={activity.holds.toLocaleString()} />
        <Tile label="Declined by OneFlow" value={activity.declined.toLocaleString()} />
        <Tile label="Cash now" value={last ? fmtUSD(last.cash as Cents) : "—"} note={activity.firstAt ? `since ${timeLabel(activity.firstAt)}` : undefined} />
      </div>
      {points.length < 2 ? (
        <p className="text-sm text-muted">Not enough history yet. Each balance change adds a point.</p>
      ) : (
        <div style={{ height: CHART_HEIGHT }} className="w-full">
          <ResponsiveContainer>
            <LineChart data={points} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="ms" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={timeLabel} tick={axisTick} axisLine={false} tickLine={false} minTickGap={32} />
              <YAxis tickFormatter={fmtAxisK} tick={axisTick} axisLine={false} tickLine={false} width={48} domain={["auto", "auto"]} />
              <Tooltip formatter={(v) => fmtUSD(Number(v))} labelFormatter={(t) => timeLabel(Number(t))} contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="stepAfter" dataKey="cash" name="Cash" stroke="var(--fg)" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="stepAfter" dataKey="cardOwed" name="Card owed" stroke="var(--bad)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="text-xs text-muted mt-2">15-minute buckets from a TimescaleDB continuous aggregate over the <code>nessie_events</code> hypertable. History starts when the accounts were opened in the bank.</p>
    </Panel>
  );
}
