"use client";
import Link from "next/link";
import { Bar } from "@/components/nova/ui";
import { fmtUSD } from "@/lib/money";
import { paceText, pct, type GoalCardModel } from "./goalModel";

export function GoalCard({ goal, active, onSelect }: { goal: GoalCardModel; active: boolean; onSelect: () => void }) {
  const p = pct(goal);
  return (
    <div className={`panel p-4 sm:p-5 h-full ${active ? "border-fg border-2" : ""}`}>
      <button type="button" onClick={onSelect} aria-pressed={active} className="w-full text-left">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-surface-2 border border-line" aria-hidden />
          <h2 className="font-semibold truncate">{goal.name}</h2>
        </div>
        <div className="mt-3"><span className="text-2xl font-semibold money">{fmtUSD(goal.saved)}</span> <span className="text-sm text-muted money">/ {fmtUSD(goal.target)}</span></div>
        <div className="flex items-center gap-3 mt-3"><div className="flex-1"><Bar pct={p} /></div><span className="text-xs font-semibold">{Math.round(p)}%</span></div>
        <p className="text-xs text-muted mt-2">{goal.monthly > 0 ? `${fmtUSD(goal.monthly)}/mo · ` : ""}{paceText(goal)}</p>
      </button>
      {goal.builtIn && <Link href="/safety-net" className="text-sm font-semibold mt-3 inline-block">Powers your safety net →</Link>}
    </div>
  );
}
