"use client";
import Link from "next/link";
import { useState } from "react";
import { PageHeader, Panel, Row, Money, fmtDate, fmtSigned, initials } from "@/components/nova/ui";
import { AreaTrend } from "@/components/nova/charts";
import { Loading } from "@/components/nova/Loading";
import { useReadyBank } from "@/components/nova/BankProvider";
import { MoveMoneyForm } from "@/components/nova/everyday/MoveMoneyForm";
import { DateChip } from "@/components/nova/everyday/DateChip";
import { SendMoneyDialog } from "@/components/nova/everyday/SendMoneyDialog";
import { CATEGORY_LABEL, type BankView } from "@/lib/bank/view";
import { fmtUSD } from "@/lib/money";

const TITLE = "Day-to-day";
const SUBTITLE = "Your everyday checking account.";
const RECENT_COUNT = 4;
type Action = "transfer" | "paycard" | null;

function InOutPanel({ view }: { view: BankView }) {
  const { inflow, outflow, net, nextPayday, nextPaycheck } = view.inOut;
  const max = Math.max(inflow, outflow, 1);
  return (
    <Panel title="Money in and out" subtitle="Checking · last 30 days">
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
        <ul className="divide-y divide-line">
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
        <Row key={t.id} icon={initials(t.merchant)} title={t.merchant} sub={`${fmtDate(t.date)} · ${CATEGORY_LABEL[t.category]}`} value={fmtSigned(t.amount)} />
      ))}
    </Panel>
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
  const cardBill = view.upcoming.find((u) => u.id === "card");
  const canPayCard = view.cardBalance > 0;
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
              <div className="text-xs text-muted mt-1">Available now · {fmtUSD(checking?.available ?? view.checking)}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {hasSavings && checking && <button className={`btn ${action === "transfer" ? "btn-primary" : ""}`} aria-expanded={action === "transfer"} onClick={() => toggle("transfer")}>Transfer</button>}
              {canPayCard && checking && <button className={`btn ${action === "paycard" ? "btn-primary" : ""}`} aria-expanded={action === "paycard"} onClick={() => toggle("paycard")}>Pay a bill</button>}
              {b.live && checking && <SendMoneyDialog availableCents={checking.available} />}
            </div>
          </div>
          {action && <MoveMoneyForm key={action} mode={action} onClose={() => setAction(null)} cardBalance={view.cardBalance} minDue={cardBill?.amount} />}
          <div className="mt-4">
            <div className="text-xs text-muted mb-1">Cash in checking + savings · last 30 days</div>
            <AreaTrend points={view.cashHistory} step />
          </div>
        </Panel>
        <InOutPanel view={view} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        <UpcomingPanel view={view} />
        <RecentPanel view={view} />
      </div>
    </>
  );
}
