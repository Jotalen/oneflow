"use client";
import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { PageHeader } from "@/components/nova/ui";
import { Loading } from "@/components/nova/Loading";
import { useReadyBank } from "@/components/nova/BankProvider";
import { Bubble, BUBBLE_GRID, BUBBLE_SPAN } from "@/components/nova/bubbles";
import { applyPrefs, bubbleDef, recommendBubbles } from "@/lib/bank/bubbles";
import { useDashboardPrefs } from "@/lib/bank/useDashboard";
import { useGoals } from "@/lib/bank/goals";

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const noSubscribe = () => () => {};

export default function OverviewPage() {
  const b = useReadyBank();
  const personaId = b?.personaId ?? "";
  const { prefs } = useDashboardPrefs(personaId);
  const { goals } = useGoals(personaId);
  // Local hour is only known in the browser; the prerendered page says "Hi" until hydration.
  const hour = useSyncExternalStore(noSubscribe, () => new Date().getHours(), () => null);

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
      {/* One grid in the saved order: small, medium and large bubbles can sit anywhere. */}
      <div className={BUBBLE_GRID}>
        {ids.map((id) => <div key={id} className={`min-w-0 ${BUBBLE_SPAN[bubbleDef(id).size]}`}><Bubble id={id} a={b.analysis} v={b.view} goal={topGoal} /></div>)}
      </div>
      <Link href="/dashboard/edit" className="btn w-full sm:hidden">✎ Edit dashboard</Link>
    </div>
  );
}
