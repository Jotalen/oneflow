"use client";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Projection } from "@/lib/engine/project";
import { fmtUSD } from "@/lib/money";

const EVENT_LABEL: Record<string, string> = { lease_end: "Lease ends", payoff: "Loan paid off", card_paid: "Card paid", expense: "One-time cost" };

export function TwoFutures({ baseline, applied, appliedLabel = "Do this" }: { baseline: Projection; applied?: Projection; appliedLabel?: string }) {
  const data = baseline.points.map((pt, i) => ({ month: pt.month, base: pt.netWorth / 100, applied: applied ? applied.points[i].netWorth / 100 : undefined }));
  const events = baseline.points.flatMap((pt) => pt.events.map((e) => ({ month: pt.month, label: EVENT_LABEL[e] ?? e })));
  const gap = applied ? applied.netWorth24 - baseline.netWorth24 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs text-muted mb-2">
        <span>Net worth, next 24 months</span>
        {applied && <span className={`money font-semibold ${gap >= 0 ? "text-good" : "text-bad"}`}>{gap >= 0 ? "+" : ""}{fmtUSD(gap)} by month 24</span>}
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="month" stroke="#a5b0d6" tick={{ fontSize: 11 }} tickFormatter={(m) => (m === 0 ? "now" : `${m}m`)} />
            <YAxis stroke="#a5b0d6" tick={{ fontSize: 11 }} width={56} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
            <Tooltip
              contentStyle={{ background: "#141b34", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, fontSize: 12 }}
              formatter={(v, name) => [fmtUSD(Math.round(Number(v) * 100)), name === "base" ? "Do nothing" : appliedLabel]}
              labelFormatter={(m) => (m === 0 ? "Today" : `Month ${m}`)}
            />
            {events.map((e, i) => (
              <ReferenceLine key={i} x={e.month} stroke="#fbbf24" strokeDasharray="4 4" label={{ value: e.label, fill: "#fbbf24", fontSize: 10, position: "insideTopRight" }} />
            ))}
            <Line type="monotone" dataKey="base" name="base" stroke="#a5b0d6" strokeWidth={2} dot={false} isAnimationActive />
            {applied && <Line type="monotone" dataKey="applied" name="applied" stroke="#7dd3fc" strokeWidth={2.5} dot={false} isAnimationActive />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
