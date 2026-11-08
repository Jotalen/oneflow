"use client";
import { PageHeader, Panel, Tile } from "@/components/nova/ui";
import { Loading } from "@/components/nova/Loading";
import { useReadyBank } from "@/components/nova/BankProvider";
import { fmtUSD } from "@/lib/money";
import { rankDebts } from "@/lib/bank/wealth";
import { DebtTable } from "@/components/nova/wealth/DebtTable";
import { PayoffPlan } from "@/components/nova/wealth/PayoffPlan";

const TITLE = "Debt & liquidity";
const SUB = "What you owe, and the cash you can reach fast.";

interface CashRow { when: string; label: string; sub?: string; value: number }

export default function DebtPage() {
  const b = useReadyBank();
  if (!b) return <><PageHeader title={TITLE} subtitle={SUB} /><Loading /></>;
  const { analysis, view } = b;
  const p = analysis.profile;
  const sum = (k: string) => p.accounts.filter((a) => a.kind === k).reduce((s, a) => s + a.balance, 0);
  const liquid = sum("checking") + sum("savings");
  const cd = sum("cd");
  const availableCredit = Math.max(0, view.cardLimit - view.cardBalance);
  const dti = analysis.health.dtiPct;
  const debtMonthly = Math.round((dti / 100) * p.incomeMonthly);
  const rows = rankDebts(p.debts);
  const top = rows.find((r) => r.order === 1);
  const c = p.contract;
  const carEquity = c && c.type === "loan" && c.estEquity > 0 && p.car ? c.estEquity : 0;

  const cashRows: CashRow[] = [
    { when: "Today", label: "Checking + savings", value: liquid },
    ...(cd > 0 ? [{ when: "Early", label: "CD", sub: "Breaking it early costs some interest", value: cd }] : []),
    ...(carEquity > 0 && p.car && c ? [{ when: "If sold", label: "Car equity", sub: `${fmtUSD(p.car.marketValue)} value − ${fmtUSD(c.balance)} owed`, value: carEquity }] : []),
  ];

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
        <DebtTable rows={rows} profile={p} />
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="If you needed cash" subtitle="Fastest money first">
            <ul className="divide-y divide-line">
              {cashRows.map((r) => (
                <li key={r.label} className="flex items-center gap-3 py-3">
                  <span className="w-16 shrink-0 text-xs font-semibold uppercase text-muted">{r.when}</span>
                  <div className="min-w-0 flex-1"><div className="text-sm font-semibold">{r.label}</div>{r.sub && <div className="text-xs text-muted">{r.sub}</div>}</div>
                  <span className="text-sm font-semibold money">{fmtUSD(r.value)}</span>
                </li>
              ))}
            </ul>
          </Panel>
          {top ? <PayoffPlan target={top} /> : <Panel title="Payoff plan"><p className="text-sm text-muted">Nothing with interest to pay down.</p></Panel>}
        </div>
      </div>
    </>
  );
}
