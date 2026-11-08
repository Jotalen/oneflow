"use client";
import Link from "next/link";
import { useState, type DragEvent } from "react";
import { PageHeader } from "@/components/nova/ui";
import { Loading } from "@/components/nova/Loading";
import { useReadyBank } from "@/components/nova/BankProvider";
import { BUBBLE_GRID, BUBBLE_SPAN } from "@/components/nova/bubbles";
import {
  addBubble, applyPrefs, BUBBLES, bubbleDef, canAddBubble, dropBubble, moveBubble, recommendBubbles, removeBubble, setAutoPick,
  type BubbleId,
} from "@/lib/bank/bubbles";
import { useDashboardPrefs } from "@/lib/bank/useDashboard";
import { useGoals } from "@/lib/bank/goals";
import { useBudgetPlan } from "@/components/nova/everyday/useBudgetPlan";
import { viewWithPlan } from "@/lib/bank/budgetPlan";

const ICON_BTN = "h-7 w-7 rounded-full border border-line text-xs disabled:opacity-40";

/** Drag to reorder, remove, add from the library. Saved per customer; their changes always win. */
export default function EditDashboardPage() {
  const b = useReadyBank();
  const personaId = b?.personaId ?? "";
  const { prefs, save, reset } = useDashboardPrefs(personaId);
  const { goals } = useGoals(personaId);
  const [plan] = useBudgetPlan(personaId);
  const [dragId, setDragId] = useState<BubbleId | null>(null);
  if (!b) return <><PageHeader title="Edit dashboard" /><Loading /></>;

  const recommended = recommendBubbles(b.analysis, viewWithPlan(b.view, plan), { hasGoal: goals.length > 0 });
  const current = applyPrefs(recommended, prefs);
  const available = BUBBLES.filter((x) => !current.includes(x.id));
  const hasContract = !!b.analysis.profile.contract;

  const onDrop = (target: BubbleId) => (e: DragEvent) => {
    e.preventDefault();
    if (dragId) save(dropBubble(prefs, current, dragId, target));
    setDragId(null);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Edit dashboard" subtitle="Reorder with the arrows or by dragging, remove what you don't need, add from the list."
        actions={<><button className="btn" onClick={reset}>Reset to recommended</button><Link href="/" className="btn btn-primary">Done</Link></>} />
      <div className="panel p-4 flex items-center justify-between gap-4">
        <div>
          <div className="font-semibold text-sm">Let OneFlow pick my bubbles</div>
          <p className="text-xs text-muted">We add a bubble when you link a loan, start a goal, or something needs your attention. Bubbles you remove stay removed.</p>
        </div>
        <button role="switch" aria-checked={prefs.auto} aria-label="Let OneFlow pick my bubbles" onClick={() => save(setAutoPick(prefs, current, !prefs.auto))}
          className={`h-7 w-12 shrink-0 rounded-full p-1 transition-colors ${prefs.auto ? "bg-ink" : "bg-line"}`}>
          <span className={`block h-5 w-5 rounded-full bg-surface transition-transform ${prefs.auto ? "translate-x-5" : ""}`} />
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem] items-start">
        <section className="min-w-0">
          <h2 className="text-sm font-semibold mb-2">On your dashboard · {current.length} bubbles</h2>
          <div className={BUBBLE_GRID}>
            {current.map((id, i) => {
              const d = bubbleDef(id);
              const chip = d.pinned ? "Always on your dashboard" : recommended.includes(id) && !prefs.added.includes(id) ? "Picked for you" : "Added by you";
              return (
                <div key={id} draggable onDragStart={() => setDragId(id)} onDragEnd={() => setDragId(null)} onDragOver={(e) => e.preventDefault()} onDrop={onDrop(id)}
                  className={`min-w-0 rounded-2xl border border-dashed border-line bg-surface p-3 cursor-grab ${BUBBLE_SPAN[d.size]} ${dragId === id ? "opacity-50" : ""}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold min-w-0"><span className="text-muted mr-1" aria-hidden>⠿</span>{d.title}</span>
                    <span className="flex gap-1">
                      <button className={ICON_BTN} aria-label={`Move ${d.title} up`} disabled={i === 0} onClick={() => save(moveBubble(prefs, current, id, -1))}>↑</button>
                      <button className={ICON_BTN} aria-label={`Move ${d.title} down`} disabled={i === current.length - 1} onClick={() => save(moveBubble(prefs, current, id, 1))}>↓</button>
                      {!d.pinned && <button className={ICON_BTN} aria-label={`Remove ${d.title}`} onClick={() => save(removeBubble(prefs, current, id))}>✕</button>}
                    </span>
                  </div>
                  <div className={`mt-2 rounded-lg ${d.id === "next_move" ? "bg-ink" : "bg-surface-2"} ${d.size === "small" ? "h-8" : "h-12"}`} />
                  <span className="chip mt-2">{chip}</span>
                </div>
              );
            })}
          </div>
        </section>
        <aside className="panel p-4">
          <h2 className="font-semibold mb-2">Add a bubble</h2>
          {available.length === 0 && <p className="text-sm text-muted">Everything is already on your dashboard.</p>}
          {available.map((d) => {
            const ok = canAddBubble(d.id, { hasContract });
            return (
              <div key={d.id} className="flex items-center gap-3 py-2 border-b border-line last:border-0">
                <div className="h-8 w-8 rounded-lg bg-surface-2 border border-line shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{d.title} {recommended.includes(d.id) && <span className="chip ml-1">Suggested</span>}</div>
                  <div className="text-xs text-muted">{ok ? d.description : "Link a car loan or lease to use this bubble"}</div>
                </div>
                <button className="h-8 w-8 shrink-0 rounded-full border border-line disabled:opacity-40" aria-label={`Add ${d.title}`} disabled={!ok} onClick={() => save(addBubble(prefs, current, recommended, d.id))}>+</button>
              </div>
            );
          })}
        </aside>
      </div>
    </div>
  );
}
