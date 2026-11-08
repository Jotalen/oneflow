"use client";
import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Segmented } from "@/components/nova/ui";
import { fmtAxisK, fmtUSD } from "@/lib/money";
import { monthLabel, type ChartRow } from "@/lib/bank/whatif";

type Series = "netWorth" | "cash";
const SERIES: { value: Series; label: string }[] = [{ value: "netWorth", label: "Net worth" }, { value: "cash", label: "Cash" }];
const KEYS: Record<Series, { base: keyof ChartRow; scen: keyof ChartRow }> = {
  netWorth: { base: "baseNetWorth", scen: "scenNetWorth" },
  cash: { base: "baseCash", scen: "scenCash" },
};
const TICKS = [0, 6, 12, 18, 24];
const axisTick = { fontSize: 11, fill: "var(--muted)" };
const kFmt = (dollars: number) => `${dollars < 0 ? "−" : ""}${fmtAxisK(Math.abs(dollars) * 100)}`;

export interface WhatIfChartProps { rows: ChartRow[]; runOutMonth: number | null; changed: boolean }

/** Do-nothing (dashed) vs what-if (solid), 24 months, net worth or liquid cash. */
export function WhatIfChart({ rows, runOutMonth, changed }: WhatIfChartProps) {
  const [series, setSeries] = useState<Series>("netWorth");
  const k = KEYS[series];
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-muted" aria-hidden />Do nothing</span>
          {changed && <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-fg" aria-hidden />What if</span>}
        </div>
        <Segmented value={series} options={SERIES} onChange={setSeries} size="sm" />
      </div>
      <div className="h-60 w-full">
        <ResponsiveContainer>
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="month" type="number" domain={[0, 24]} ticks={TICKS} tickFormatter={(m: number) => (m === 0 ? "Now" : `${m}m`)} tick={axisTick} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={kFmt} tick={axisTick} axisLine={false} tickLine={false} width={48} domain={["auto", "auto"]} />
            <Tooltip
              formatter={(v, name) => [fmtUSD(Math.round(Number(v) * 100)), name === "base" ? "Do nothing" : "What if"]}
              labelFormatter={(m) => (Number(m) === 0 ? "Today" : `Month ${m} · ${monthLabel(Number(m))}`)}
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 12 }}
            />
            {series === "cash" && <ReferenceLine y={0} stroke="var(--bad)" strokeDasharray="2 3" />}
            {runOutMonth !== null && <ReferenceLine x={runOutMonth} stroke="var(--bad)" strokeDasharray="4 4" label={{ value: "Out of cash", fill: "var(--bad)", fontSize: 10, position: "insideTopLeft" }} />}
            <Line type="monotone" dataKey={k.base} name="base" stroke="var(--muted)" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            {changed && <Line type="monotone" dataKey={k.scen} name="scen" stroke="var(--fg)" strokeWidth={2.5} dot={false} isAnimationActive={false} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
