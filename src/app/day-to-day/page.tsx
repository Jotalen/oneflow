"use client";
import { pendingCents } from "@/lib/bank/pending";
import Link from "next/link";
import { useState } from "react";
import { PageHeader, Panel, Row, Money, Segmented, fmtDate, fmtSigned, initials } from "@/components/nova/ui";
import { BalanceTrend } from "@/components/nova/charts";
import { Loading } from "@/components/nova/Loading";
import { useReadyBank } from "@/components/nova/BankProvider";
import { MoveMoneyForm } from "@/components/nova/everyday/MoveMoneyForm";
import { DateChip } from "@/components/nova/everyday/DateChip";
import { SendMoneyDialog } from "@/components/nova/everyday/SendMoneyDialog";
import { WalletLoader } from "@/components/solana/WalletLoader";
import { CATEGORY_LABEL, type BankView, type LedgerTxn } from "@/lib/bank/view";
import { BALANCE_RANGES, balanceSeries, type BalanceRange } from "@/lib/bank/balanceEstimate";
import { billOptions } from "@/lib/bank/everyday";
import type { Profile } from "@/lib/engine/types";
import { fmtUSD } from "@/lib/money";

const TITLE = "Day-to-day";
const SUBTITLE = "Your everyday checking account.";
const RECENT_COUNT = 4;
const RANGE_LABEL: Record<BalanceRange, string> = { "1M": "last month", "3M": "last 3 months", "6M": "last 6 months" };
type Action = "transfer" | "paybill" | null;

function InOutPanel({ view }: { view: BankView }) {
  const { inflow, outflow, net, nextPayday, nextPaycheck, days } = view.inOut;
  const max = Math.max(inflow, outflow, 1);
  return (
    <Panel title="Money in and out" subtitle={`Checking · last ${days / 7} weeks`}>
      <div className="space-y-3 text-sm">
        <div>
          <div className="flex justify-between"><span>In</span><span className="font-semibold money">{fmtSigned(inflow)}</span></div>
          <div className="h-2 rounded-full bg-line mt-1"><div className="h-full rounded-full bg-ink" style={{ width: `${(inflow / max) * 100}%` }} /></div>
        </div>
        <div>
          <div className="flex justify-between"><span>Out</span><span className="font-semibold money">{fmtSigned(-outflow)}</span></div>
          <div className="h-2 rounded-full bg-line mt-1"><div className="h-full rounded-full bg-muted" style={{ width: `${(outflow / max) * 100}%` }} /></div>
        </div>
        <div className="flex justify-between border-t border-line pt-3"><span className="font-semibold">Net</span><span className="text-lg font-semibold money">{fmtSigned(net)}</span></div>
        <div className="rounded-xl bg-surface-2 p-3">
          <div className="text-xs text-muted">Next payday (estimated half of monthly income)</div>
          <div className="font-semibold">{fmtDate(nextPayday)} · {fmtSigned(nextPaycheck)}</div>
        </div>
      </div>
    </Panel>
  );
}

function UpcomingPanel({ view }: { view: BankView }) {
  const bills = view.upcoming;
  const total = bills.reduce((s, b) => s + b.amount, 0);
  const last = bills[bills.length - 1];
  return (
    <Panel title="Upcoming bills" right={last ? <span className="text-xs text-muted">{fmtUSD(total)} due by {fmtDate(last.date)}</span> : undefined}>
      {bills.length === 0 ? <p className="text-sm text-muted">No recurring bills on file.</p> : (
        <ul className="divide-y divide-line max-h-72 overflow-y-auto overscroll-contain pr-1 -mr-1" tabIndex={0} aria-label={`${bills.length} upcoming bills`}>
          {bills.map((b) => (
            <li key={b.id} className="flex items-center gap-3 py-2.5">
              <DateChip iso={b.date} />
              <div className="min-w-0 flex-1"><div className="text-sm font-semibold truncate">{b.label}</div><div className="text-xs text-muted truncate">{b.detail}</div></div>
              <div className="text-sm font-semibold money">{fmtSigned(-b.amount)}</div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function RecentPanel({ view }: { view: BankView }) {
  const rows = view.ledger.filter((t) => t.accountKind === "checking").slice(0, RECENT_COUNT);
  return (
    <Panel title="Recent activity" right={<Link href="/transactions" className="font-semibold">All transactions →</Link>}>
      {rows.length === 0 ? <p className="text-sm text-muted">No checking activity yet.</p> : rows.map((t) => (
        <Row key={`${t.id}:${t.accountId}`} icon={initials(t.merchant)} title={t.merchant} sub={`${fmtDate(t.date)} · ${CATEGORY_LABEL[t.category]}`} value={fmtSigned(t.amount)} />
      ))}
    </Panel>
  );
}

function BalanceChart({ profile, ledger }: { profile: Profile; ledger: LedgerTxn[] }) {
  const [range, setRange] = useState<BalanceRange>("1M");
  const series = balanceSeries(profile, ledger, range);
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <div className="text-xs text-muted">Checking balance · {RANGE_LABEL[range]}</div>
        <Segmented size="sm" value={range} onChange={setRange} options={BALANCE_RANGES.map((r) => ({ value: r, label: r }))} />
      </div>
      <BalanceTrend points={series.points} estimatedUntil={series.estimatedUntil} />
      {series.estimatedUntil && (
        <p className="text-[0.7rem] text-muted mt-1">
          Dashed line before {fmtDate(series.estimatedUntil, true)} is an estimate. The bank keeps about 8 weeks of your history, so we rebuilt earlier days from your paychecks and recurring bills.
        </p>
      )}
    </div>
  );
}

export default function DayToDayPage() {
  const b = useReadyBank();
  const [action, setAction] = useState<Action>(null);
  if (!b) return <><PageHeader title={TITLE} subtitle={SUBTITLE} /><Loading /></>;
  const { analysis, view } = b;
  const p = analysis.profile;
  const checking = p.accounts.find((a) => a.kind === "checking");
  const hasSavings = p.accounts.some((a) => a.kind === "savings");
  const bills = billOptions(view.upcoming, view.cardBalance);
  const toggle = (a: Exclude<Action, null>) => setAction((cur) => (cur === a ? null : a));

  return (
    <>
      <PageHeader title={TITLE} subtitle={SUBTITLE} />
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Panel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">{checking?.nickname ?? "Checking"}</div>
              <div className="text-3xl sm:text-4xl font-semibold money mt-1"><Money cents={view.checking} /></div>
              <div className="text-xs text-muted mt-1">Available now · {fmtUSD(checking?.available ?? view.checking)}{checking && pendingCents(checking) > 0 && <> · {fmtUSD(pendingCents(checking))} pending</>}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {hasSavings && checking && <button className={`btn ${action === "transfer" ? "btn-primary" : ""}`} aria-expanded={action === "transfer"} onClick={() => toggle("transfer")}>Transfer</button>}
              {checking && <button className={`btn ${action === "paybill" ? "btn-primary" : ""}`} aria-expanded={action === "paybill"} onClick={() => toggle("paybill")}>Pay a bill</button>}
              {b.live && checking && <SendMoneyDialog availableCents={checking.available} />}
              <Link href="/solana" className="btn">Pay with Solana</Link>
            </div>
          </div>
          {action && <MoveMoneyForm key={action} mode={action} onClose={() => setAction(null)} cardBalance={view.cardBalance} bills={bills} />}
          <BalanceChart profile={p} ledger={view.ledger} />
        </Panel>
        <InOutPanel view={view} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 mt-4">
        <UpcomingPanel view={view} />
        <RecentPanel view={view} />
      </div>
      <div className="mt-4"><WalletLoader mode="activity" /></div>
    </>
  );
}
