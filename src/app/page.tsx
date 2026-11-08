"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/nova/ui";
import { Loading } from "@/components/nova/Loading";
import { useReadyBank } from "@/components/nova/BankProvider";
import { NextMoveHero } from "@/components/nova/NextMoveHero";
import { Bubble } from "@/components/nova/bubbles";
import { applyPrefs, bubbleDef, recommendBubbles } from "@/lib/bank/bubbles";
import { useDashboardPrefs } from "@/lib/bank/useDashboard";
import { useGoals } from "@/lib/bank/goals";

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function OverviewPage() {
  const b = useReadyBank();
  const personaId = b?.personaId ?? "";
  const { prefs } = useDashboardPrefs(personaId);
  const { goals } = useGoals(personaId);
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => setHour(new Date().getHours()), []);

  const topGoal = useMemo(() => {
    const withPct = goals.map((g) => ({ ...g, pct: g.target ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0 }));
    return withPct.sort((x, y) => y.pct - x.pct)[0];
  }, [goals]);

  const name = b?.persona?.name ?? "";
  const title = hour === null ? `Hi, ${name}!` : `${greeting(hour)}, ${name}!`;
  const editBtn = <Link href="/dashboard/edit" className="btn hidden sm:inline-flex">✎ Edit dashboard</Link>;
  if (!b) return <><PageHeader title="Welcome back" subtitle="Here's your financial overview." /><Loading /></>;

  const ids = applyPrefs(recommendBubbles(b.analysis, b.view, { hasGoal: goals.length > 0 }), prefs);
  return (
    <div className="space-y-4">
      <PageHeader title={title} subtitle={<>Here&apos;s your financial overview.{b.offline && <span className="chip ml-2">offline snapshot</span>}</>} actions={editBtn} />
      <NextMoveHero />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {ids.filter((id) => bubbleDef(id).size === "small").map((id) => <div key={id}><Bubble id={id} a={b.analysis} v={b.view} goal={topGoal} /></div>)}
      </div>
      <div className="grid lg:grid-cols-3 gap-3 sm:gap-4 grid-flow-row-dense">
        {ids.filter((id) => bubbleDef(id).size !== "small").map((id) => {
          const el = <Bubble id={id} a={b.analysis} v={b.view} goal={topGoal} />;
          return el ? <div key={id} className={bubbleDef(id).size === "large" ? "lg:col-span-2" : ""}>{el}</div> : null;
        })}
      </div>
      <Link href="/dashboard/edit" className="btn w-full sm:hidden">✎ Edit dashboard</Link>
    </div>
  );
}
