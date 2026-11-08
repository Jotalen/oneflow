"use client";
import { useId } from "react";
import type { Budget } from "@/lib/bank/view";
import { wheelSlices, type WheelSlice } from "@/lib/bank/budgetPlan";
import { fmtUSD } from "@/lib/money";
import { fmtMonth } from "@/components/nova/ui";

/**
 * "Pizza" budget wheel: one equal slice per budget category. Each slice fills from the centre
 * toward the crust in proportion to how much of that category's budget is used (radius = share
 * used), so an untouched category is an empty slice and a used-up one reaches the rim. Over budget
 * turns the slice the warning colour and adds a band outside the rim. The numbered list beside it
 * carries the same facts in text for screen readers and small screens.
 */
const SIZE = 260;
const C = SIZE / 2;
const R = 100;
const LABEL_R = 121;
/** Room around the wheel so the number labels (e.g. "10!") never touch the SVG edge. */
const PAD = 10;
const VIEW_BOX = `${-PAD} ${-PAD} ${SIZE + 2 * PAD} ${SIZE + 2 * PAD}`;
const OVER_IN = R + 3;
const OVER_OUT = R + 9;
const GAP_DEG = 1.6;
const MAX_SPAN = 359.9;
const SLICE_FILLS = ["var(--accent)", "var(--accent-2, var(--muted))"];
const OVER_FILL = "var(--warn)";

const polar = (r: number, deg: number): [number, number] => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(rad), C + r * Math.sin(rad)];
};
const pt = ([x, y]: [number, number]) => `${x.toFixed(2)} ${y.toFixed(2)}`;
const largeArc = (a0: number, a1: number) => (a1 - a0 > 180 ? 1 : 0);

function wedge(r: number, a0: number, a1: number): string {
  if (r <= 0) return "";
  return `M ${C} ${C} L ${pt(polar(r, a0))} A ${r} ${r} 0 ${largeArc(a0, a1)} 1 ${pt(polar(r, a1))} Z`;
}

function band(r0: number, r1: number, a0: number, a1: number): string {
  const f = largeArc(a0, a1);
  return `M ${pt(polar(r1, a0))} A ${r1} ${r1} 0 ${f} 1 ${pt(polar(r1, a1))} L ${pt(polar(r0, a1))} A ${r0} ${r0} 0 ${f} 0 ${pt(polar(r0, a0))} Z`;
}

const statusText = (s: WheelSlice): string => {
  if (s.over) return s.limit > 0 ? `Over by ${fmtUSD(s.overBy)} (${s.pct}%)` : `${fmtUSD(s.spent)} spent, no budget set`;
  if (s.fixed) return s.spent >= s.limit ? "Paid" : "Due this month";
  return `${fmtUSD(s.limit - s.spent)} left (${s.pct}% used)`;
};

function Slice({ s, i, n }: { s: WheelSlice; i: number; n: number }) {
  const span = Math.min(360 / n - (n > 1 ? GAP_DEG : 0), MAX_SPAN);
  const a0 = (360 / n) * i + (n > 1 ? GAP_DEG / 2 : 0);
  const a1 = a0 + span;
  const fill = s.over ? OVER_FILL : SLICE_FILLS[i % SLICE_FILLS.length];
  const [lx, ly] = polar(LABEL_R, (a0 + a1) / 2);
  return (
    <g>
      <title>{`${s.label}: ${fmtUSD(s.spent)} of ${fmtUSD(s.limit)} · ${statusText(s)}`}</title>
      <path d={wedge(R, a0, a1)} fill="var(--surface-2)" stroke="var(--line)" strokeWidth={1} />
      {s.fill > 0 && <path d={wedge(R * s.fill, a0, a1)} fill={fill} fillOpacity={s.over ? 1 : 0.85} />}
      {s.over && <path d={band(OVER_IN, OVER_OUT, a0, a1)} fill={OVER_FILL} />}
      <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600} fill={s.over ? OVER_FILL : "var(--muted)"}>
        {i + 1}{s.over ? "!" : ""}
      </text>
    </g>
  );
}

function Legend({ slices }: { slices: WheelSlice[] }) {
  return (
    <ol className="divide-y divide-line text-sm min-w-0">
      {slices.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2.5 py-2">
          <span aria-hidden className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.7rem] font-semibold ${s.over ? "bg-warn text-ink-fg" : "bg-surface-2 text-muted"}`}>{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold truncate">{s.label}{s.fixed && <span className="text-xs text-muted font-normal"> · bills</span>}</div>
            <div className={`text-xs ${s.over ? "text-warn font-semibold" : "text-muted"}`}>{s.over ? "⚠ " : ""}{statusText(s)}</div>
          </div>
          <div className="text-xs money text-right shrink-0">{fmtUSD(s.spent)}<span className="text-muted"> / {fmtUSD(s.limit)}</span></div>
        </li>
      ))}
    </ol>
  );
}

export function BudgetWheel({ budget }: { budget: Budget }) {
  const id = useId();
  const slices = wheelSlices(budget);
  const over = slices.filter((s) => s.over);
  const summary = `${slices.length} categories. ${over.length ? `Over budget: ${over.map((s) => s.label).join(", ")}.` : "None over budget."} Each slice fills from the centre as its budget is used. Details are in the numbered list.`;
  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,17rem)_1fr] items-start">
      <figure className="mx-auto w-full max-w-[17rem]">
        <svg viewBox={VIEW_BOX} className="w-full h-auto" role="img" aria-labelledby={`${id}-t ${id}-d`}>
          <title id={`${id}-t`}>Budget wheel for {fmtMonth(budget.month)}</title>
          <desc id={`${id}-d`}>{summary}</desc>
          {slices.map((s, i) => <Slice key={s.key} s={s} i={i} n={slices.length} />)}
          <circle cx={C} cy={C} r={R / 2} fill="none" stroke="var(--line)" strokeDasharray="2 3" aria-hidden />
        </svg>
        <figcaption className="text-[0.7rem] text-muted text-center mt-1">
          Slices fill from the centre as you spend. Full = budget used. <span className="text-warn font-semibold">Amber rim</span> = over budget. Dotted ring = halfway.
        </figcaption>
      </figure>
      <Legend slices={slices} />
    </div>
  );
}
