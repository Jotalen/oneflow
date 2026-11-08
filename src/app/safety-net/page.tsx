"use client";
import { useState } from "react";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/nova/ui";
import { Loading } from "@/components/nova/Loading";
import { useReadyBank } from "@/components/nova/BankProvider";
import { AskAi } from "@/components/nova/AskAi";
import { fmtUSD, type Cents } from "@/lib/money";
import { applyEssentialOverrides, essentialsTotal, runway, safetyStatus } from "@/lib/bank/wealth";
import { AmountForm } from "@/components/nova/wealth/AmountForm";
import { ActionNote } from "@/components/nova/wealth/ActionNote";
import { EssentialsEditor } from "@/components/nova/wealth/EssentialsEditor";
import { useEssentialOverrides } from "@/components/nova/wealth/useEssentials";
import { useMoneyMove } from "@/components/nova/wealth/useMoneyMove";

const TITLE = "Safety net";
const SUB = "How long you'd be okay if your paycheck stopped.";
const SCALE = [0, 1, 2, 3, 4, 5, 6];
const MIN_MONTHS = 3;
const PURPOSE = "Safety net: emergency fund";

function ScaleBar({ months, goal }: { months: number; goal: number }) {
  const pct = Math.min(100, (months / goal) * 100);
  return (
    <div>
      <div className="relative h-4 rounded-full bg-line overflow-hidden" role="progressbar" aria-valuenow={months} aria-valuemin={0} aria-valuemax={goal} aria-label="Months covered">
        <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted mt-1">{SCALE.map((n) => <span key={n}>{n === goal ? `${n}+ mo` : n}</span>)}</div>
    </div>
  );
}

export default function SafetyNetPage() {
  const b = useReadyBank();
  const [adding, setAdding] = useState(false);
  const move = useMoneyMove();
  const { overrides, setOverride } = useEssentialOverrides(b?.personaId ?? "");
  if (!b) return <><PageHeader title={TITLE} subtitle={SUB} /><Loading /></>;
  const { view, transfer, transferring } = b;
  const sn = view.safetyNet;
  const items = applyEssentialOverrides(sn.essentials, overrides);
  const essentialsMonthly = essentialsTotal(items);
  const r = runway(sn.fund, essentialsMonthly);
  const months = r?.months ?? 0;
  const target = essentialsMonthly * sn.goalMonths;
  const adjusted = items.some((e) => e.adjusted);
  const hasCd = b.analysis.profile.accounts.some((a) => a.kind === "cd");

  const send = async (cents: Cents, label: string) => {
    const res = await move.run(() => transfer("checking", "savings", cents, PURPOSE), label);
    if (res.ok) setAdding(false);
  };

  return (
    <>
      <PageHeader title={TITLE} subtitle={SUB} />
      <div className="grid gap-4">
        <Panel>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              {r && <span className="chip">{safetyStatus(months)}</span>}
              <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-4xl sm:text-5xl font-semibold tracking-tight whitespace-nowrap">{r ? `${months.toFixed(1)} months` : "—"}</span>
                {r && <span className="text-base sm:text-lg font-semibold text-muted whitespace-nowrap">· about {r.days} days</span>}
              </div>
              <p className="text-sm mt-1">{r ? "of essential expenses covered" : "Add your monthly essentials to see how long you'd be covered"}</p>
              <p className="text-xs text-muted">Cash {fmtUSD(sn.fund)} (checking, savings{hasCd ? ", CD" : ""}) ÷ essentials {fmtUSD(essentialsMonthly)} a month{adjusted ? ", with your changes" : ""}</p>
            </div>
            <div>
              <ScaleBar months={months} goal={sn.goalMonths} />
              <div className="flex flex-wrap justify-between gap-2 text-xs text-muted mt-2">
                <span>{months >= MIN_MONTHS ? `You're past the ${MIN_MONTHS}-month minimum` : `${MIN_MONTHS} months is the minimum to aim for`}</span>
                <span>Goal: {sn.goalMonths} months ({fmtUSD(target)})</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <button className="btn btn-primary" onClick={() => setAdding((v) => !v)}>Add money</button>
                <Link href="/goals" className="btn">See the emergency fund goal</Link>
              </div>
              {adding && <AmountForm label="Add money to savings" submitLabel="Move" max={view.checking} busy={transferring} onSubmit={(c) => void send(c, `Moved ${fmtUSD(c)} from checking to savings.`)} onCancel={() => setAdding(false)} />}
              <ActionNote result={move.result} okText={move.okText} />
            </div>
          </div>
        </Panel>

        <Panel>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <h2 className="font-semibold leading-tight">Monthly essentials</h2>
              <AskAi topic="safety_net" essentialsOverrides={overrides} />
            </div>
            <span className="font-semibold money text-sm shrink-0">{fmtUSD(essentialsMonthly)}</span>
          </div>
          <EssentialsEditor items={items} onChange={setOverride} />
          <p className="text-xs text-muted mt-3">We estimate groceries, gas, health and phone &amp; subscriptions from your recent transactions. Change them to what you&apos;d really spend in an emergency; your runway updates. Fixed bills like your car payment and other debt payments stay locked. Your changes are saved on this device.</p>
        </Panel>
      </div>
    </>
  );
}
