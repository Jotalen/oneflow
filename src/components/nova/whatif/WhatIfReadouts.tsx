"use client";
import { Tile } from "@/components/nova/ui";
import type { Cents } from "@/lib/money";
import { HORIZON_MONTHS, fmtSignedWhole, fmtWhole, monthLabel, type Direction, type IndicatorChange, type WhatIfResult } from "@/lib/bank/whatif";

const vsNothing = (c: Cents) => (c === 0 ? "Same as doing nothing" : `${fmtSignedWhole(c)} vs doing nothing`);
const at = (m: number) => (m === 0 ? "Today" : `Month ${m} · ${monthLabel(m)}`);

/** The four numbers judges ask about: month-24 change, lowest cash, run-out, overdraft fees. */
export function KeyNumbers({ r }: { r: WhatIfResult }) {
  const last = HORIZON_MONTHS;
  const out = r.runOut.scenario;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile label={`Net worth · month ${last}`} value={fmtWhole(r.scenario.netWorth24)} note={vsNothing(r.netWorthDelta24)} />
      <Tile label={`Cash · month ${last}`} value={fmtWhole(r.scenario.points[last].liquid)} note={vsNothing(r.cashDelta24)} />
      <Tile label="Lowest cash" value={<span className={r.low.scenario.liquid < 0 ? "text-bad" : ""}>{fmtWhole(r.low.scenario.liquid)}</span>} note={at(r.low.scenario.month)} />
      <Tile label={out === null ? "Overdraft fees" : "Runs out of cash"}
        value={out === null ? fmtWhole(r.fees.scenario) : <span className="text-bad">Month {out}</span>}
        note={out === null ? `None in ${last} months` : `${monthLabel(out)} · ${fmtWhole(r.fees.scenario)} in overdraft fees`} />
    </div>
  );
}

const MARK: Record<Direction, { text: string; cls: string }> = {
  better: { text: "Better", cls: "text-good" },
  worse: { text: "Worse", cls: "text-bad" },
  same: { text: "No change", cls: "text-muted" },
};

/** Health indicators at month 24: do nothing vs what if. */
export function IndicatorTable({ changes }: { changes: IndicatorChange[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs text-muted text-left">
          <th className="font-normal pb-2">Indicator</th>
          <th className="font-normal pb-2 text-right">Do nothing</th>
          <th className="font-normal pb-2 text-right">What if</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {changes.map((c) => (
          <tr key={c.key} className={c.direction === "same" ? "" : "font-semibold"}>
            <td className="py-2 pr-2">
              <div>{c.label}</div>
              <div className={`text-[0.7rem] font-normal ${MARK[c.direction].cls}`}>{MARK[c.direction].text}</div>
            </td>
            <td className="py-2 text-right money font-normal text-muted whitespace-nowrap">{c.base}</td>
            <td className={`py-2 pl-2 text-right money whitespace-nowrap ${MARK[c.direction].cls === "text-muted" ? "" : MARK[c.direction].cls}`}>{c.scenario}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
