"use client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, LineChart, Bar as RBar, BarChart, ReferenceLine } from "recharts";
import { fmtUSD, type Cents } from "@/lib/money";
import { fmtDate } from "./ui";

export interface TrendPoint { date: string; value: Cents }
const axisTick = { fontSize: 11, fill: "var(--muted)" };
const kFmt = (c: number) => `$${Math.round(c / 100_000)}k`;

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
