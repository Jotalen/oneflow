"use client";
import { Panel, fmtDate, fmtMonth } from "@/components/nova/ui";
import { fmtUSD } from "@/lib/money";
import { AS_OF, type Profile } from "@/lib/engine/types";
import { addMonths, nextDueDate, payoffWithExtra } from "@/lib/bank/view";
import type { RankedDebt } from "@/lib/bank/wealth";

const CARD_DUE_DAY = 21;

function paidOff(r: RankedDebt, p: Profile): string {
  const d = r.debt;
  if (d.kind === "auto_lease") return p.contract ? `Lease ends ${fmtMonth(addMonths(AS_OF, p.contract.monthsRemaining))}` : "—";
  const { months } = payoffWithExtra(d.balance, d.aprPct, d.monthlyPayment, 0);
  if (!Number.isFinite(months)) return "Minimum doesn't cover interest";
  return `${fmtMonth(addMonths(AS_OF, months))}${d.kind === "card" ? " at minimum" : ""}`;
}

function dueDay(r: RankedDebt, p: Profile): number {
  if (r.debt.dueDay) return r.debt.dueDay;
  if (r.debt.kind === "card") return CARD_DUE_DAY;
  return p.contract?.dueDay ?? 1;
}

export function DebtTable({ rows, profile }: { rows: RankedDebt[]; profile: Profile }) {
  if (!rows.length) return <Panel title="Your debts"><p className="text-sm text-muted">No debts. Nice.</p></Panel>;
  return (
    <Panel title="Your debts">
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm min-w-[560px]">
          <thead><tr className="text-left text-xs text-muted border-b border-line">
            <th className="py-2 px-1 font-medium">Debt</th><th className="px-1 font-medium">Balance</th><th className="px-1 font-medium">APR</th>
            <th className="px-1 font-medium">Monthly</th><th className="px-1 font-medium">Paid off</th><th className="px-1 font-medium">Pay order</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.debt.id} className="border-b border-line last:border-0">
                <td className="py-3 px-1 font-semibold">{r.debt.label}</td>
                <td className="px-1 money font-semibold">{fmtUSD(r.debt.balance)}</td>
                <td className="px-1">{r.apr === null ? "—" : `${r.apr}%`}</td>
                <td className="px-1 money">{fmtUSD(r.debt.monthlyPayment)}{r.debt.kind === "card" ? " min" : ""} · {fmtDate(nextDueDate(dueDay(r, profile)))}</td>
                <td className="px-1">{paidOff(r, profile)}</td>
                <td className="px-1">{r.order === null ? <span className="text-xs text-muted">Lease</span> : <span className={`chip ${r.order === 1 ? "bg-ink text-ink-fg" : ""}`}>{r.order === 1 ? "1 · highest rate" : r.order}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
