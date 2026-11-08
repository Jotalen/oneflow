"use client";
import type { FinanceOption } from "@/lib/bank/borrowing";
import { fmtUSD, type Cents } from "@/lib/money";

/** Rate-sheet rows. Desktop table, stacked cards on mobile. Best fit is outlined. */
export function RateTable({ rows, label, targetMonthly }: { rows: FinanceOption[]; label: string; targetMonthly: Cents }) {
  if (rows.length === 0) return <p className="text-sm text-muted">Enter an amount to see options.</p>;
  const note = (r: FinanceOption) => (r.bestFit ? `Best fit · under your ${fmtUSD(targetMonthly)} target` : "");
  return (
    <>
      <table className="hidden sm:table w-full text-sm">
        <thead className="text-xs text-muted text-left">
          <tr><th className="py-2 font-normal">Offer</th><th className="font-normal">Term</th><th className="font-normal">APR</th><th className="font-normal">Monthly</th><th className="font-normal">Total interest</th><th className="font-normal">Total of payments</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.term} className={`border-t border-line ${r.bestFit ? "outline outline-2 outline-fg -outline-offset-2" : ""}`}>
              <td className="py-3 pl-2"><div className="font-semibold">{label}</div><div className="text-xs text-muted">{note(r) || r.tierLabel}</div></td>
              <td>{r.term} mo</td>
              <td>{r.apr.toFixed(2)}%</td>
              <td className="font-semibold money">{fmtUSD(r.monthly)}</td>
              <td className="money">{fmtUSD(r.totalInterest)}</td>
              <td className="money">{fmtUSD(r.totalPayments)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="sm:hidden space-y-2">
        {rows.map((r) => (
          <li key={r.term} className={`rounded-xl p-3 ${r.bestFit ? "border-2 border-fg" : "bg-surface-2"}`}>
            <div className="flex justify-between text-sm"><b>{r.term} mo · {r.apr.toFixed(2)}%</b><b className="money">{fmtUSD(r.monthly)}/mo</b></div>
            <div className="text-xs text-muted mt-1 money">Interest {fmtUSD(r.totalInterest)} · total {fmtUSD(r.totalPayments)}</div>
            {r.bestFit && <div className="text-xs font-semibold mt-1">{note(r)}</div>}
          </li>
        ))}
      </ul>
    </>
  );
}
