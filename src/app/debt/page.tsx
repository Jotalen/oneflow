"use client";
import { PageHeader, Panel, Tile } from "@/components/nova/ui";
import { Loading } from "@/components/nova/Loading";
import { useReadyBank } from "@/components/nova/BankProvider";
import { fmtUSD } from "@/lib/money";
import { rankDebts } from "@/lib/bank/wealth";
import { PayoffPlan } from "@/components/nova/wealth/PayoffPlan";
import { LoanList } from "@/components/nova/borrowing/LoanList";
import { CreditCards, cardRows } from "@/components/nova/borrowing/CreditCards";

const TITLE = "Debt & liquidity";
const SUB = "What you owe, and the cash you can reach fast.";

export default function DebtPage() {
  const b = useReadyBank();
  if (!b) return <><PageHeader title={TITLE} subtitle={SUB} /><Loading /></>;
  const { analysis, view } = b;
  const p = analysis.profile;
  const liquid = p.accounts.filter((a) => a.kind === "checking" || a.kind === "savings").reduce((s, a) => s + a.balance, 0);
  const availableCredit = Math.max(0, view.cardLimit - view.cardBalance);
  const dti = analysis.health.dtiPct;
  const debtMonthly = Math.round((dti / 100) * p.incomeMonthly);
  const top = rankDebts(p.debts).find((r) => r.order === 1);
  const loans = p.debts.filter((d) => d.kind !== "card");

  return (
    <>
      <PageHeader title={TITLE} subtitle={SUB} />
      <div className="grid gap-4">
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Tile label="Total debt" value={fmtUSD(view.totalDebt)} note={p.contract?.type === "lease" ? "Includes remaining lease payments" : undefined} />
          <Tile label="Cash you can use today" value={fmtUSD(liquid)} note="Checking + savings" />
          <Tile label="Available credit" value={fmtUSD(availableCredit)} note={`of ${fmtUSD(view.cardLimit)} limit`} />
          <Tile label="Debt payments" value={`${Math.round(dti)}%`} note={`of monthly income · ${fmtUSD(debtMonthly)}/mo`} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <LoanList loans={loans} profile={p} />
          <CreditCards cards={cardRows(p.accounts, p.debts)} rewards={view.rewards} />
        </div>
        {top ? <PayoffPlan target={top} debts={p.debts} /> : <Panel title="Payoff plan"><p className="text-sm text-muted">Nothing with interest to pay down.</p></Panel>}
      </div>
    </>
  );
}
