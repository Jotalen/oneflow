"use client";
import type { HealthReport } from "@/lib/engine/health";
import { Card } from "./ui/Card";

type Tone = "good" | "warn" | "bad" | "muted";
interface Row { key: keyof HealthReport; label: string; value: string; tone: Tone; help: string }

const toneClass: Record<Tone, string> = { good: "text-good", warn: "text-warn", bad: "text-bad", muted: "text-muted" };
const band = (v: number, good: number, warn: number, higherIsBetter = true): Tone => {
  if (higherIsBetter) return v >= good ? "good" : v >= warn ? "warn" : "bad";
  return v <= good ? "good" : v <= warn ? "warn" : "bad";
};

export const RUNWAY_GOOD = 3, RUNWAY_WARN = 1;
export const DTI_GOOD = 36, DTI_WARN = 43;
export const UTIL_GOOD = 30, UTIL_WARN = 50;
export const SAVINGS_GOOD = 10, SAVINGS_WARN = 0;
export const PTI_GOOD = 10, PTI_WARN = 15;
export const SUBS_GOOD = 3, SUBS_WARN = 6;

export function rows(h: HealthReport): Row[] {
  return [
    { key: "runwayMonths", label: "Runway", value: `${h.runwayMonths} mo`, tone: band(h.runwayMonths, RUNWAY_GOOD, RUNWAY_WARN), help: "Liquid cash ÷ essential monthly spend" },
    { key: "dtiPct", label: "Debt-to-income", value: `${h.dtiPct}%`, tone: band(h.dtiPct, DTI_GOOD, DTI_WARN, false), help: "Monthly debt payments ÷ gross income" },
    { key: "utilizationPct", label: "Card utilization", value: `${h.utilizationPct}%`, tone: band(h.utilizationPct, UTIL_GOOD, UTIL_WARN, false), help: "Card balances ÷ credit limits" },
    { key: "savingsRatePct", label: "Savings rate", value: `${h.savingsRatePct}%`, tone: band(h.savingsRatePct, SAVINGS_GOOD, SAVINGS_WARN), help: "(Take-home − all outflows) ÷ take-home" },
    { key: "shockResilient", label: "$1,500 shock", value: h.shockResilient ? "Covered" : "Not covered", tone: h.shockResilient ? "good" : "bad", help: "Can liquid cash absorb a $1,500 surprise?" },
    { key: "carEquityRatio", label: "Car equity", value: h.carEquityRatio === null ? "—" : `${Math.round(h.carEquityRatio * 100)}%`, tone: h.carEquityRatio === null ? "muted" : h.carEquityRatio >= 0.1 ? "good" : h.carEquityRatio >= 0 ? "warn" : "bad", help: "Estimated equity ÷ market value" },
    { key: "ptiPct", label: "Payment-to-income", value: `${h.ptiPct}%`, tone: band(h.ptiPct, PTI_GOOD, PTI_WARN, false), help: "Vehicle payment ÷ gross income" },
    { key: "subscriptionBurdenPct", label: "Subscription burden", value: `${h.subscriptionBurdenPct}%`, tone: band(h.subscriptionBurdenPct, SUBS_GOOD, SUBS_WARN, false), help: "Recurring subscriptions ÷ gross income" },
  ];
}

export function HealthScorecard({ health }: { health: HealthReport }) {
  return (
    <Card eyebrow="Health scorecard" title="8 indicators, computed from the data">
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {rows(health).map((r) => (
          <div key={r.key} className="rounded-xl bg-surface-2 p-3" title={r.help}>
            <dt className="text-[0.7rem] uppercase tracking-wider text-muted">{r.label}</dt>
            <dd className={`money text-xl font-semibold ${toneClass[r.tone]}`}>{r.value}</dd>
            <dd className="text-[0.68rem] text-muted mt-0.5 leading-tight">{r.help}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
