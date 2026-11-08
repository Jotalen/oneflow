"use client";
import { useState } from "react";
import { PageHeader, Panel, Tile } from "@/components/nova/ui";
import { Loading } from "@/components/nova/Loading";
import { useReadyBank } from "@/components/nova/BankProvider";
import { useGoals } from "@/lib/bank/goals";
import { applyEssentialOverrides, essentialsTotal } from "@/lib/bank/wealth";
import { fmtUSD } from "@/lib/money";
import { GoalCard } from "@/components/nova/wealth/GoalCard";
import { GoalDetail } from "@/components/nova/wealth/GoalDetail";
import { GoalForm } from "@/components/nova/wealth/GoalForm";
import { useEssentialOverrides } from "@/components/nova/wealth/useEssentials";
import { emergencyGoal, type GoalCardModel } from "@/components/nova/wealth/goalModel";

const TITLE = "Savings goals";
const SUB = "Money set aside for the things you're planning.";

export default function GoalsPage() {
  const b = useReadyBank();
  const personaId = b?.personaId ?? "";
  const { goals, add, credit, update, remove } = useGoals(personaId);
  const { overrides } = useEssentialOverrides(personaId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const newBtn = <button className="btn btn-primary" onClick={() => setCreating(true)}>+ New goal</button>;
  if (!b) return <><PageHeader title={TITLE} subtitle={SUB} /><Loading /></>;
  const { view, transfer, transferring } = b;
  const sn = view.safetyNet;
  const essentialsMonthly = essentialsTotal(applyEssentialOverrides(sn.essentials, overrides));

  const cards: GoalCardModel[] = [
    emergencyGoal(sn.fund, essentialsMonthly * sn.goalMonths),
    ...goals.map((g) => ({ ...g, builtIn: false })),
  ];
  const selected = cards.find((c) => c.id === selectedId) ?? null;
  const planned = goals.reduce((s, g) => s + g.monthly, 0);
  const toggle = (id: string) => setSelectedId((cur) => (cur === id ? null : id));

  return (
    <>
      <PageHeader title={TITLE} subtitle={SUB} actions={newBtn} />
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Tile label="Total saved" value={fmtUSD(sn.fund)} note="Your cash with us, goals included" />
          <Tile label="Planned saving" value={`${fmtUSD(planned)} / month`} note="From your goals' monthly plans" />
          <Tile label="Goals" value={`${cards.length} active`} />
        </div>

        {creating && (
          <Panel title="New goal" subtitle="Goals are envelopes inside your savings account. Pick a date or a monthly amount and we'll work out the other.">
            <GoalForm submitLabel="Create goal" onCancel={() => setCreating(false)} onSubmit={(g) => { add(g); setCreating(false); }} />
          </Panel>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((g) => <GoalCard key={g.id} goal={g} active={g.id === selected?.id} onSelect={() => toggle(g.id)} />)}
        </div>

        {selected ? (
          <GoalDetail
            key={selected.id}
            goal={selected}
            checkingAvailable={view.checking}
            transferring={transferring}
            transfer={(amt, note) => transfer("checking", "savings", amt, note)}
            onCredit={(amt, note) => credit(selected.id, amt, note)}
            onUpdate={(g) => update(selected.id, g)}
            onDelete={() => { remove(selected.id); setSelectedId(null); }}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <p className="text-sm text-muted">Tap a goal to add money or change it.</p>
        )}
      </div>
    </>
  );
}
