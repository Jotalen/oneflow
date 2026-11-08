"use client";
import { Panel, fmtDate, fmtMonth } from "@/components/nova/ui";
import { addMonths, nextDueDate, payoffWithExtra } from "@/lib/bank/view";
import { AS_OF, type Debt, type Profile } from "@/lib/engine/types";
import { fmtUSD } from "@/lib/money";

const KIND_LABEL: Record<Debt["kind"], string> = { auto_loan: "Car loan", auto_lease: "Car lease", card: "Card", other: "Loan" };

function paidOff(d: Debt, p: Profile): string {
  if (d.kind === "auto_lease") return p.contract ? `Lease ends ${fmtMonth(addMonths(AS_OF, p.contract.monthsRemaining))}` : "Lease";
  const { months } = payoffWithExtra(d.balance, d.aprPct, d.monthlyPayment, 0);
  return Number.isFinite(months) ? `Paid off ${fmtMonth(addMonths(AS_OF, months))}` : "Payment doesn't cover interest";
}

/** "Loans": car, house, school, medical… whatever non-card debt the customer has. */
export function LoanList({ loans, profile }: { loans: Debt[]; profile: Profile }) {
  return (
    <Panel title="Loans" subtitle={loans.length ? `${fmtUSD(loans.reduce((s, d) => s + d.balance, 0))} total` : undefined}>
      {loans.length === 0 && <p className="text-sm text-muted">No loans.</p>}
      <ul className="divide-y divide-line">
        {loans.map((d) => (
          <li key={d.id} className="flex items-start gap-3 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{d.label}</div>
              <div className="text-xs text-muted">
                {KIND_LABEL[d.kind]}{d.kind === "auto_lease" ? "" : ` · ${d.aprPct}% APR`} · {fmtUSD(d.monthlyPayment)}/mo, next {fmtDate(nextDueDate(d.dueDay ?? profile.contract?.dueDay ?? 1))}
              </div>
              <div className="text-xs text-muted">{paidOff(d, profile)}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold money">{fmtUSD(d.balance)}</div>
              {d.kind === "auto_lease" && <div className="text-[0.7rem] text-muted">lease balance</div>}
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
