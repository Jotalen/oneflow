"use client";
import { useState } from "react";
import Link from "next/link";
import { Panel, fmtDate } from "@/components/nova/ui";
import { fmtUSD, type Cents } from "@/lib/money";
import type { TransferResult } from "@/components/nova/BankProvider";
import { Donut } from "./Donut";
import { AmountForm } from "./AmountForm";
import { ActionNote } from "./ActionNote";
import { GoalForm, type GoalDraft } from "./GoalForm";
import { pct, type GoalCardModel } from "./goalModel";
import { useMoneyMove } from "./useMoneyMove";

interface Props {
  goal: GoalCardModel;
  checkingAvailable: Cents;
  transferring: boolean;
  transfer: (amount: Cents, note: string) => Promise<TransferResult>;
  onCredit: (amount: Cents, note: string) => void;
  onUpdate: (g: GoalDraft) => void;
  onDelete: () => void;
}

type Mode = "idle" | "add" | "edit" | "confirmDelete";

export function GoalDetail({ goal, checkingAvailable, transferring, transfer, onCredit, onUpdate, onDelete }: Props) {
  const [mode, setMode] = useState<Mode>("idle");
  const move = useMoneyMove();
  const toGo = Math.max(0, goal.target - goal.saved);

  const addMoney = async (cents: Cents) => {
    const note = `Goal: ${goal.name}`;
    const r = await move.run(() => transfer(cents, note), `Moved ${fmtUSD(cents)} from checking to savings for ${goal.name}.`);
    if (r.ok) { if (!goal.builtIn) onCredit(cents, "Added from checking"); setMode("idle"); }
  };

  return (
    <Panel>
      <div className="grid gap-6 md:grid-cols-[160px_1fr_240px] items-start">
        <div className="flex flex-col items-center">
          <Donut pct={pct(goal)} label={`${goal.name} ${Math.round(pct(goal))}% saved`} />
          <div className="text-sm font-semibold mt-2 money">{toGo > 0 ? `${fmtUSD(toGo)} to go` : "Reached"}</div>
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold mb-2">{goal.name} {goal.builtIn ? "" : "deposits"}</h2>
          {goal.builtIn ? (
            <p className="text-sm text-muted">This is your real savings balance against 6 months of essentials. It isn&apos;t a separate envelope, so there&apos;s no deposit list. <Link href="/safety-net" className="font-semibold text-fg">See your safety net →</Link></p>
          ) : goal.history.length ? (
            <ul className="divide-y divide-line">
              {goal.history.map((h, i) => (
                <li key={`${h.date}-${i}`} className="flex justify-between py-2 text-sm"><span>{fmtDate(h.date, true)} · {h.note}</span><span className="font-semibold money">+{fmtUSD(h.amount)}</span></li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">No deposits yet. Add money to get started.</p>}
        </div>
        <div>
          <h2 className="font-semibold">Settings</h2>
          <p className="text-xs text-muted mt-1">{goal.monthly > 0 ? `Plan: ${fmtUSD(goal.monthly)} a month from checking.` : "Money moves from checking into savings."}</p>
          <div className="grid gap-2 mt-3">
            <button className="btn btn-primary" onClick={() => setMode(mode === "add" ? "idle" : "add")}>Add money</button>
            {mode === "add" && <AmountForm label={`Add money to ${goal.name}`} submitLabel="Move" max={checkingAvailable} busy={transferring} initial={goal.monthly || undefined} onSubmit={addMoney} onCancel={() => setMode("idle")} />}
            {!goal.builtIn && <button className="btn" onClick={() => setMode(mode === "edit" ? "idle" : "edit")}>Edit goal</button>}
            {!goal.builtIn && mode !== "confirmDelete" && <button className="btn" onClick={() => setMode("confirmDelete")}>Delete goal</button>}
            {mode === "confirmDelete" && (
              <div className="text-xs">
                <p>Delete this goal? Money stays in savings.</p>
                <div className="flex gap-2 mt-2"><button className="btn text-sm" onClick={onDelete}>Yes, delete</button><button className="btn text-sm" onClick={() => setMode("idle")}>Keep</button></div>
              </div>
            )}
          </div>
          <ActionNote result={move.result} okText={move.okText} />
        </div>
      </div>
      {mode === "edit" && (
        <div className="mt-5 border-t border-line pt-4">
          <GoalForm initial={{ name: goal.name, target: goal.target, monthly: goal.monthly }} submitLabel="Save changes" onSubmit={(g) => { onUpdate(g); setMode("idle"); }} onCancel={() => setMode("idle")} />
        </div>
      )}
    </Panel>
  );
}
