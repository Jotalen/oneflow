"use client";
import { useState } from "react";
import { PageHeader, Panel, Tile, Bar, Segmented, fmtDate } from "@/components/nova/ui";
import { MonthBars } from "@/components/nova/charts";
import { Loading } from "@/components/nova/Loading";
import { useReadyBank } from "@/components/nova/BankProvider";
import { useBudgetPlan } from "@/components/nova/everyday/useBudgetPlan";
import { BudgetCategories } from "@/components/nova/everyday/BudgetCategories";
import { BudgetWheel } from "@/components/nova/everyday/BudgetWheel";
import { AS_OF } from "@/lib/engine/types";
import { CATEGORY_LABEL, SPENDING_CATEGORIES, type Budget, type BudgetCategory, type LedgerTxn } from "@/lib/bank/view";
import { monthlySpend, type BudgetOverrides } from "@/lib/bank/everyday";
import { planBudget, switchMode, type BudgetMode } from "@/lib/bank/budgetPlan";
import { fmtUSD } from "@/lib/money";

const TITLE = "Budget";
const PCT = 100;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MODES: { value: BudgetMode; label: string }[] = [{ value: "auto", label: "Set it for me" }, { value: "manual", label: "Set my own" }];
const MODE_NOTE: Record<BudgetMode, string> = {
  auto: "Amounts suggested from your last 8 weeks of spending, plus your real bills.",
  manual: "Your own amount for each category. Bills stay at their real amounts.",
};

function SpentPanel({ budget }: { budget: Budget }) {
  const daysLeft = Math.max(0, budget.daysInMonth - budget.dayOfMonth);
  const left = Math.max(0, budget.limit - budget.spent);
  const over = budget.categories.filter((c) => c.spent > c.limit).length;
  const pct = budget.limit ? Math.round((budget.spent / budget.limit) * PCT) : 0;
  const paidFixed = budget.categories.filter((c) => c.fixed && c.spent >= c.limit && c.limit > 0).map((c) => (c.detail ?? c.label).toLowerCase());
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

/** Rows to edit: every spending category in "Set my own", the suggested lines in "Set it for me". */
function editorRows(budget: Budget, mode: BudgetMode): BudgetCategory[] {
  if (mode === "auto") return budget.categories;
  return SPENDING_CATEGORIES.map((key) => budget.categories.find((c) => c.key === key)
    ?? { key, label: CATEGORY_LABEL[key], spent: 0, limit: 0, note: "", fixed: false });
}

export default function BudgetPage() {
  const b = useReadyBank();
  const [editing, setEditing] = useState(false);
  const [plan, savePlan] = useBudgetPlan(b?.personaId ?? "");
  const subtitle = b ? `${MONTHS[Number(b.view.budget.month.slice(5, 7)) - 1]} · ${Math.max(0, b.view.budget.daysInMonth - b.view.budget.dayOfMonth)} days left` : undefined;
  if (!b) return <><PageHeader title={TITLE} /><Loading /></>;
  const suggested = b.view.budget;
  const ledger = b.view.ledger;
  const budget = planBudget(suggested, ledger, plan);
  const flexLimit = budget.categories.filter((c) => !c.fixed).reduce((s, c) => s + c.limit, 0);
  const save = (amounts: BudgetOverrides) => {
    savePlan(plan.mode === "auto" ? { ...plan, auto: amounts } : { ...plan, manual: amounts }, suggested, ledger);
    setEditing(false);
  };
  const changeMode = (mode: BudgetMode) => {
    if (mode === plan.mode) return;
    savePlan(switchMode(plan, mode, suggested), suggested, ledger);
    setEditing(mode === "manual" && Object.keys(plan.manual).length === 0);
  };

  return (
    <>
      <PageHeader title={TITLE} subtitle={subtitle}
        actions={<button className={`btn ${editing ? "btn-primary" : ""}`} aria-pressed={editing} onClick={() => setEditing((e) => !e)}>{editing ? "Editing…" : "Edit amounts"}</button>} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-4">
        <Segmented value={plan.mode} options={MODES} onChange={changeMode} />
        <p className="text-xs text-muted">{MODE_NOTE[plan.mode]}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <SpentPanel budget={budget} />
        <HistoryPanel ledger={ledger} flexLimit={flexLimit} />
      </div>
      <div className="mt-4">
        <Panel title={editing ? "Edit your budget" : "Where your budget stands"} subtitle={editing ? undefined : "One slice per category"}>
          {editing ? (
            <BudgetCategories key={plan.mode} rows={editorRows(budget, plan.mode)} mode={plan.mode}
              canReset={plan.mode === "auto" && Object.keys(plan.auto).length > 0}
              onSave={save} onCancel={() => setEditing(false)} onReset={() => save({})} />
          ) : budget.categories.length === 0 ? (
            <p className="text-sm text-muted">No spending or bills to budget yet. {plan.mode === "manual" ? "Choose Edit amounts to set your own." : ""}</p>
          ) : <BudgetWheel budget={budget} />}
        </Panel>
      </div>
    </>
  );
}
