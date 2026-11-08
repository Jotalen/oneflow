"use client";
import { useState } from "react";
import { PageHeader, Panel, Tile, Bar, fmtDate } from "@/components/nova/ui";
import { MonthBars } from "@/components/nova/charts";
import { Loading } from "@/components/nova/Loading";
import { useReadyBank } from "@/components/nova/BankProvider";
import { useStored } from "@/components/nova/everyday/useStored";
import { BudgetCategories } from "@/components/nova/everyday/BudgetCategories";
import { AS_OF } from "@/lib/engine/types";
import type { Budget, LedgerTxn } from "@/lib/bank/view";
import { applyBudgetOverrides, monthlySpend, type BudgetOverrides } from "@/lib/bank/everyday";
import { fmtUSD } from "@/lib/money";

const TITLE = "Budget";
const PCT = 100;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function SpentPanel({ budget }: { budget: Budget }) {
  const daysLeft = Math.max(0, budget.daysInMonth - budget.dayOfMonth);
  const left = Math.max(0, budget.limit - budget.spent);
  const over = budget.categories.filter((c) => c.spent > c.limit).length;
  const pct = budget.limit ? Math.round((budget.spent / budget.limit) * PCT) : 0;
  const paidFixed = budget.categories.filter((c) => c.fixed && c.spent >= c.limit && c.limit > 0).map((c) => c.label.toLowerCase());
  return (
    <Panel title="Spent so far">
      <div className="flex items-baseline gap-2 flex-wrap"><span className="text-3xl sm:text-4xl font-semibold money">{fmtUSD(budget.spent)}</span><span className="text-muted">of {fmtUSD(budget.limit)}</span></div>
      <div className="mt-3"><Bar pct={pct} tone={budget.spent > budget.limit ? "bad" : "ink"} marker={(budget.dayOfMonth / budget.daysInMonth) * PCT} /></div>
      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted mt-1.5">
        <span>{pct}% spent{paidFixed.length ? ` · ${paidFixed.join(", ")} already paid` : ""}</span>
        <span>Today, day {budget.dayOfMonth} of {budget.daysInMonth}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
        <Tile label="Left to spend" value={fmtUSD(left)} />
        <Tile label="Per day" value={daysLeft ? `About ${fmtUSD(Math.floor(left / daysLeft / 100) * 100).replace(/\.00$/, "")}` : "—"} note={`${daysLeft} days left`} />
        <Tile label="Over budget" value={`${over} ${over === 1 ? "category" : "categories"}`} />
      </div>
    </Panel>
  );
}

function HistoryPanel({ ledger, flexLimit }: { ledger: LedgerTxn[]; flexLimit: number }) {
  const months = monthlySpend(ledger);
  const first = ledger.length ? ledger[ledger.length - 1].date : AS_OF;
  const short = (m: string) => MONTHS[Number(m.slice(5, 7)) - 1].slice(0, 3);
  const data = months.map((m) => {
    const partial = m.month === AS_OF.slice(0, 7) || (m.month === first.slice(0, 7) && !first.endsWith("-01"));
    return { label: `${short(m.month)}${partial ? "*" : ""}`, value: m.spent, current: m.month === AS_OF.slice(0, 7) };
  });
  return (
    <Panel title="Months we have data for" subtitle={`Everyday purchases · dashed line is your ${fmtUSD(flexLimit)} flexible budget`}>
      {data.length === 0 ? <p className="text-sm text-muted">No spending yet.</p> : <MonthBars data={data} budget={flexLimit} />}
      <p className="text-[0.7rem] text-muted mt-1">* Partial month. Your history here starts {fmtDate(first, true)}; older months aren&apos;t in your records.</p>
    </Panel>
  );
}

export default function BudgetPage() {
  const b = useReadyBank();
  const [editing, setEditing] = useState(false);
  const [overrides, setOverrides] = useStored<BudgetOverrides>("budget", b?.personaId ?? "", {});
  const subtitle = b ? `${MONTHS[Number(b.view.budget.month.slice(5, 7)) - 1]} · ${Math.max(0, b.view.budget.daysInMonth - b.view.budget.dayOfMonth)} days left` : undefined;
  if (!b) return <><PageHeader title={TITLE} /><Loading /></>;
  const budget = applyBudgetOverrides(b.view.budget, overrides);
  const flexLimit = budget.categories.filter((c) => !c.fixed).reduce((s, c) => s + c.limit, 0);

  return (
    <>
      <PageHeader title={TITLE} subtitle={subtitle}
        actions={<button className={`btn ${editing ? "btn-primary" : ""}`} aria-pressed={editing} onClick={() => setEditing((e) => !e)}>{editing ? "Editing…" : "Edit budget"}</button>} />
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <SpentPanel budget={budget} />
        <HistoryPanel ledger={b.view.ledger} flexLimit={flexLimit} />
      </div>
      <div className="mt-4">
        <Panel title="Categories">
          {budget.categories.length === 0 ? <p className="text-sm text-muted">No spending or bills to budget yet.</p> : (
            <BudgetCategories key={editing ? "edit" : "view"} budget={budget} editing={editing} overrides={overrides}
              onSave={(o) => { setOverrides(o); setEditing(false); }} onCancel={() => setEditing(false)} />
          )}
        </Panel>
      </div>
    </>
  );
}
