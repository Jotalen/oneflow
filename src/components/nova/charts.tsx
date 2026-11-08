"use client";
import { Area, AreaChart, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, LineChart, Bar as RBar, BarChart, ReferenceArea, ReferenceLine } from "recharts";
import { fmtUSD, type Cents } from "@/lib/money";
import type { BalancePoint } from "@/lib/bank/balanceEstimate";
import { fmtDate } from "./ui";

export interface TrendPoint { date: string; value: Cents }
const axisTick = { fontSize: 11, fill: "var(--muted)" };
const kFmt = (c: number) => `$${Math.round(c / 100_000)}k`;
const tooltipStyle = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 12 };
const SERIES_NAME: Record<string, string> = { real: "Balance", estimated: "Estimated" };
const ESTIMATE_DASH = "5 4";
/** $0.5k / $17.5k / $18k: keeps one decimal so nearby ticks never repeat. */
const balanceTick = (c: number) => `$${(c / 100_000).toFixed(1).replace(/\.0$/, "")}k`;

const threeTicks = (dates: string[]) => (dates.length > 2 ? [dates[0], dates[Math.floor(dates.length / 2)], dates[dates.length - 1]] : undefined);

/**
 * Checking balance: solid smooth line for real history, dashed line over a shaded band for the
 * estimated part (older than the bank's real records). The legend says which is which.
 */
export function BalanceTrend({ points, estimatedUntil, height = 180 }: { points: BalancePoint[]; estimatedUntil: string | null; height?: number }) {
  const first = points[0]?.date;
  return (
    <div>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer>
          <ComposedChart data={points} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            {estimatedUntil && first && <ReferenceArea x1={first} x2={estimatedUntil} fill="var(--surface-2)" fillOpacity={0.9} ifOverflow="extendDomain" />}
            <XAxis dataKey="date" ticks={threeTicks(points.map((p) => p.date))} tickFormatter={(d: string) => fmtDate(d)} tick={axisTick} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={balanceTick} tick={axisTick} axisLine={false} tickLine={false} width={44} domain={["auto", "auto"]} allowDecimals={false} tickCount={4} />
            <Tooltip formatter={(v, name) => [fmtUSD(Number(v)), SERIES_NAME[String(name)] ?? String(name)]} labelFormatter={(d) => fmtDate(String(d), true)} contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="real" stroke="var(--fg)" strokeWidth={2} fill="var(--fg)" fillOpacity={0.08} isAnimationActive={false} connectNulls={false} />
            {estimatedUntil && <Line type="monotone" dataKey="estimated" stroke="var(--muted)" strokeWidth={2} strokeDasharray={ESTIMATE_DASH} dot={false} isAnimationActive={false} connectNulls={false} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {estimatedUntil && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.7rem] text-muted mt-1" aria-hidden>
          <span className="inline-flex items-center gap-1.5"><svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke="var(--fg)" strokeWidth="2" /></svg>Actual</span>
          <span className="inline-flex items-center gap-1.5"><svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke="var(--muted)" strokeWidth="2" strokeDasharray="4 3" /></svg>Estimated</span>
        </div>
      )}
    </div>
  );
}

/** Filled trend line (Total balance, Net worth, Day-to-day). */
export function AreaTrend({ points, height = 180, step }: { points: TrendPoint[]; height?: number; step?: boolean }) {
  const ticks = points.length > 2 ? [points[0].date, points[Math.floor(points.length / 2)].date, points[points.length - 1].date] : undefined;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <AreaChart data={points} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="date" ticks={ticks} tickFormatter={(d: string) => fmtDate(d)} tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={kFmt} tick={axisTick} axisLine={false} tickLine={false} width={44} domain={["auto", "auto"]} />
          <Tooltip formatter={(v) => fmtUSD(Number(v))} labelFormatter={(d) => fmtDate(String(d), true)} contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 12 }} />
          <Area type={step ? "stepAfter" : "monotone"} dataKey="value" stroke="var(--fg)" strokeWidth={2} fill="var(--fg)" fillOpacity={0.08} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Tiny line for stat bubbles. */
export function Sparkline({ values, height = 28, width = 72 }: { values: number[]; height?: number; width?: number }) {
  const data = values.map((v, i) => ({ i, v }));
  return (
    <div style={{ height, width }} aria-hidden>
      <ResponsiveContainer>
        <LineChart data={data}><Line type="monotone" dataKey="v" stroke="var(--fg)" strokeWidth={1.5} dot={false} isAnimationActive={false} /></LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Monthly bars with an optional dashed budget line. */
export function MonthBars({ data, budget, height = 160 }: { data: { label: string; value: Cents; current?: boolean }[]; budget?: Cents; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => fmtUSD(Number(v))} contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 12 }} cursor={{ fill: "var(--surface-2)" }} />
          {budget !== undefined && <ReferenceLine y={budget} stroke="var(--fg)" strokeDasharray="4 4" />}
          <RBar dataKey="value" fill="var(--fg)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
