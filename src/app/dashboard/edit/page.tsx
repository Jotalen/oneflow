"use client";
import Link from "next/link";
import { useState, type DragEvent } from "react";
import { PageHeader } from "@/components/nova/ui";
import { Loading } from "@/components/nova/Loading";
import { useReadyBank } from "@/components/nova/BankProvider";
import { applyPrefs, BUBBLES, bubbleDef, recommendBubbles, type BubbleId } from "@/lib/bank/bubbles";
import { useDashboardPrefs } from "@/lib/bank/useDashboard";
import { useGoals } from "@/lib/bank/goals";

const SIZE_SPAN = { small: "sm:col-span-1", medium: "sm:col-span-2", large: "sm:col-span-2" } as const;

/** Drag to reorder, remove, add from the library. Saved per customer; their changes always win. */
export default function EditDashboardPage() {
  const b = useReadyBank();
  const personaId = b?.personaId ?? "";
  const { prefs, save, reset } = useDashboardPrefs(personaId);
  const { goals } = useGoals(personaId);
  const [dragId, setDragId] = useState<BubbleId | null>(null);
  if (!b) return <><PageHeader title="Edit dashboard" /><Loading /></>;

  const recommended = recommendBubbles(b.analysis, b.view, { hasGoal: goals.length > 0 });
  const current = applyPrefs(recommended, prefs);
  const available = BUBBLES.filter((x) => !current.includes(x.id));
  const contract = b.analysis.profile.contract;
  const canAdd = (id: BubbleId) => id !== "house" && !(id === "car_financing" && !contract) && !(id === "savings_goal" && goals.length === 0);

  const setOrder = (order: BubbleId[]) => save({ ...prefs, order });
  const remove = (id: BubbleId) => save({ ...prefs, order: current.filter((x) => x !== id), removed: [...prefs.removed, id], added: prefs.added.filter((x) => x !== id) });
  const add = (id: BubbleId) => save({ ...prefs, order: [...current, id], removed: prefs.removed.filter((x) => x !== id), added: recommended.includes(id) ? prefs.added : [...prefs.added, id] });
  const move = (id: BubbleId, d: number) => {
    const i = current.indexOf(id), j = i + d;
    if (j < 0 || j >= current.length) return;
    const next = [...current];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };
  const onDrop = (target: BubbleId) => (e: DragEvent) => {
    e.preventDefault();
    if (!dragId || dragId === target) return;
    const next = current.filter((x) => x !== dragId);
    next.splice(next.indexOf(target), 0, dragId);
    setOrder(next);
    setDragId(null);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Edit dashboard" subtitle="Drag to reorder, remove what you don't need, add from the right."
        actions={<><button className="btn" onClick={reset}>Reset to recommended</button><Link href="/" className="btn btn-primary">Done</Link></>} />
      <div className="panel p-4 flex items-center justify-between gap-4">
        <div>
          <div className="font-semibold text-sm">Let NovaBank pick my bubbles</div>
          <p className="text-xs text-muted">We add a bubble when you link a loan, start a goal, or something needs your attention. Bubbles you remove stay removed.</p>
        </div>
        <button role="switch" aria-checked={prefs.auto} aria-label="Let NovaBank pick my bubbles" onClick={() => save({ ...prefs, auto: !prefs.auto, order: prefs.order ?? current })}
          className={`h-7 w-12 shrink-0 rounded-full p-1 transition-colors ${prefs.auto ? "bg-ink" : "bg-line"}`}>
          <span className={`block h-5 w-5 rounded-full bg-surface transition-transform ${prefs.auto ? "translate-x-5" : ""}`} />
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem] items-start">
        <section>
          <h2 className="text-sm font-semibold mb-2">On your dashboard · {current.length + 1} bubbles</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3 rounded-2xl border border-dashed border-line bg-surface p-3">
              <div className="flex justify-between text-sm font-semibold"><span>Next best move</span><span className="chip">Always on top</span></div>
              <div className="mt-2 h-8 rounded-lg bg-ink" />
            </div>
            {current.map((id, i) => {
              const d = bubbleDef(id);
              const picked = recommended.includes(id) && !prefs.added.includes(id);
              return (
                <div key={id} draggable onDragStart={() => setDragId(id)} onDragOver={(e) => e.preventDefault()} onDrop={onDrop(id)}
                  className={`rounded-2xl border border-dashed border-line bg-surface p-3 cursor-grab ${SIZE_SPAN[d.size]} ${dragId === id ? "opacity-50" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold"><span className="text-muted mr-1" aria-hidden>⠿</span>{d.title}</span>
                    <span className="flex gap-1">
                      <button className="h-7 w-7 rounded-full border border-line text-xs" aria-label={`Move ${d.title} up`} disabled={i === 0} onClick={() => move(id, -1)}>↑</button>
                      <button className="h-7 w-7 rounded-full border border-line text-xs" aria-label={`Move ${d.title} down`} disabled={i === current.length - 1} onClick={() => move(id, 1)}>↓</button>
                      <button className="h-7 w-7 rounded-full border border-line text-xs" aria-label={`Remove ${d.title}`} onClick={() => remove(id)}>✕</button>
                    </span>
                  </div>
                  <div className={`mt-2 rounded-lg bg-surface-2 ${d.size === "small" ? "h-8" : "h-16"}`} />
                  <span className="chip mt-2">{picked ? "Picked for you" : "Added by you"}</span>
                </div>
              );
            })}
          </div>
        </section>
        <aside className="panel p-4">
          <h2 className="font-semibold mb-2">Add a bubble</h2>
          {available.length === 0 && <p className="text-sm text-muted">Everything is already on your dashboard.</p>}
          {available.map((d) => (
            <div key={d.id} className="flex items-center gap-3 py-2 border-b border-line last:border-0">
              <div className="h-8 w-8 rounded-lg bg-surface-2 border border-line shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{d.title} {recommended.includes(d.id) && <span className="chip ml-1">Suggested</span>}</div>
                <div className="text-xs text-muted">{canAdd(d.id) ? `Added when: ${d.rule}` : d.id === "house" ? "Link a mortgage to use this bubble" : d.id === "savings_goal" ? "Start a goal to use this bubble" : "Link a car loan or lease to use this bubble"}</div>
              </div>
              <button className="h-8 w-8 rounded-full border border-line disabled:opacity-40" aria-label={`Add ${d.title}`} disabled={!canAdd(d.id)} onClick={() => add(d.id)}>+</button>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
