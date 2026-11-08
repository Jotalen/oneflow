"use client";
import { useState } from "react";
import Link from "next/link";
import { PageHeader, Panel, fmtMonth } from "@/components/nova/ui";
import { Loading } from "@/components/nova/Loading";
import { useReadyBank } from "@/components/nova/BankProvider";
import { fmtUSD, type Cents } from "@/lib/money";
import { runwayDays, safetyStatus } from "@/lib/bank/wealth";
import { AmountForm } from "@/components/nova/wealth/AmountForm";
import { ActionNote } from "@/components/nova/wealth/ActionNote";
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
  const [picked, setPicked] = useState<number | null>(null);
  const move = useMoneyMove();
  if (!b) return <><PageHeader title={TITLE} subtitle={SUB} /><Loading /></>;
  const { view, transfer, transferring } = b;
  const sn = view.safetyNet;
  const target = sn.essentialsMonthly * sn.goalMonths;
  const days = runwayDays(sn.fund, sn.essentialsMonthly);
  const option = picked === null ? null : sn.options[picked];

  const send = async (cents: Cents, label: string) => {
    const r = await move.run(() => transfer("checking", "savings", cents, PURPOSE), label);
    if (r.ok) setAdding(false);
  };

  return (
    <>
      <PageHeader title={TITLE} subtitle={SUB} />
      <div className="grid gap-4">
        <Panel>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <span className="chip">{safetyStatus(sn.months)}</span>
              <div className="text-5xl font-semibold tracking-tight mt-2">{sn.months.toFixed(1)} months</div>
              <p className="text-sm mt-1">of essential expenses covered</p>
              <p className="text-xs text-muted">Savings {fmtUSD(sn.fund)} ÷ essentials {fmtUSD(sn.essentialsMonthly)} a month</p>
            </div>
            <div>
              <ScaleBar months={sn.months} goal={sn.goalMonths} />
              <div className="flex flex-wrap justify-between gap-2 text-xs text-muted mt-2">
                <span>{sn.months >= MIN_MONTHS ? `You're past the ${MIN_MONTHS}-month minimum` : `${MIN_MONTHS} months is the minimum to aim for`}</span>
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

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Monthly essentials" right={<span className="font-semibold money">{fmtUSD(sn.essentialsMonthly)}</span>}>
            {sn.essentials.length ? (
              <ul className="divide-y divide-line">
                {sn.essentials.map((e) => <li key={e.label} className="flex justify-between py-2.5 text-sm"><span>{e.label}</span><span className="font-semibold money">{fmtUSD(e.value)}</span></li>)}
              </ul>
            ) : <p className="text-sm text-muted">We don&apos;t see recurring essentials yet.</p>}
            <p className="text-xs text-muted mt-3">Essentials are your car payment, other debt payments, and typical monthly groceries, gas, health and phone spending from your recent transactions.</p>
          </Panel>
          <Panel title="If your paycheck stopped" subtitle="Using only your savings">
            <div className="text-3xl font-semibold">{days} days</div>
            <p className="text-sm text-muted mt-1">Your savings would cover essentials for about {days} days{sn.fund > 0 ? "" : ". You have no savings set aside yet"}.</p>
            <ul className="divide-y divide-line mt-3 text-sm">
              <li className="flex justify-between py-2"><span>Savings</span><span className="font-semibold money">{fmtUSD(sn.fund)}</span></li>
              <li className="flex justify-between py-2"><span>Checking (not counted)</span><span className="font-semibold money">{fmtUSD(view.checking)}</span></li>
              <li className="flex justify-between py-2"><span>Essentials per day</span><span className="font-semibold money">{fmtUSD(Math.round(sn.essentialsMonthly / 30))}</span></li>
            </ul>
          </Panel>
        </div>

        <Panel title={`Reach ${sn.goalMonths} months faster`} subtitle="Pick an amount. Moving it now sends one transfer from checking to savings today.">
          <div className="grid gap-3 sm:grid-cols-3">
            {sn.options.map((o, i) => (
              <button key={o.monthly} type="button" aria-pressed={picked === i} onClick={() => setPicked(i)}
                className={`text-left rounded-xl border p-4 ${picked === i ? "border-fg border-2" : "border-line"}`}>
                <div className="font-semibold">{fmtUSD(o.monthly)} / month</div>
                <div className="text-xs text-muted mt-1">{o.months === 0 ? "Already at goal" : Number.isFinite(o.months) ? `${sn.goalMonths} months by ${fmtMonth(o.date)}` : "—"}</div>
              </button>
            ))}
          </div>
          {option && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button className="btn btn-primary" disabled={transferring || option.monthly > view.checking}
                onClick={() => void send(option.monthly, `Moved this month's ${fmtUSD(option.monthly)} to savings. Repeat monthly to stay on pace.`)}>
                {transferring ? "Moving…" : `Move ${fmtUSD(option.monthly)} now`}
              </button>
              <span className="text-xs text-muted">{option.monthly > view.checking ? "Not enough in checking for this amount." : "One transfer today. We don't schedule repeats yet."}</span>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
