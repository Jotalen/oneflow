"use client";
import type { Profile } from "@/lib/engine/types";
import { fmtUSD } from "@/lib/money";
import { Card } from "./ui/Card";

/** PNC's grouping. Groups render only when non-empty (Assumption 6). */
export function AccountGroups({ profile }: { profile: Profile }) {
  const groups: { label: string; rows: { name: string; value: number; sub?: string }[] }[] = [
    { label: "Checking", rows: profile.accounts.filter((a) => a.kind === "checking").map((a) => ({ name: a.nickname, value: a.balance, sub: `available ${fmtUSD(a.available)}` })) },
    { label: "Savings", rows: profile.accounts.filter((a) => a.kind === "savings").map((a) => ({ name: a.nickname, value: a.balance })) },
    { label: "CDs & IRAs", rows: profile.accounts.filter((a) => a.kind === "cd").map((a) => ({ name: a.nickname, value: a.balance })) },
    { label: "Loans", rows: profile.debts.filter((d) => d.kind === "auto_loan" || d.kind === "other").map((d) => ({ name: d.label, value: -d.balance, sub: `${fmtUSD(d.monthlyPayment)}/mo · ${d.aprPct}% APR` })) },
    { label: "Leases", rows: profile.debts.filter((d) => d.kind === "auto_lease").map((d) => ({ name: d.label, value: -d.balance, sub: `${fmtUSD(d.monthlyPayment)}/mo · ${d.monthsRemaining} mo left` })) },
    { label: "Credit cards", rows: profile.accounts.filter((a) => a.kind === "card").map((a) => ({ name: a.nickname, value: -a.balance, sub: a.creditLimit ? `limit ${fmtUSD(a.creditLimit)}` : undefined })) },
    { label: "Mortgage", rows: [] },
  ].filter((g) => g.rows.length > 0);
  // A lease is not a debt you own (ADR: lease = rent); leave it out of net.
  const net = profile.accounts.filter((a) => a.kind !== "card").reduce((s, a) => s + a.balance, 0) - profile.debts.filter((d) => d.kind !== "auto_lease").reduce((s, d) => s + d.balance, 0);
  return (
    <Card eyebrow="Your picture" title="Accounts" right={<span className={`money text-sm ${net >= 0 ? "text-good" : "text-bad"}`}>net {fmtUSD(net)}</span>}>
      <div className="grid gap-4 sm:grid-cols-2">
        {groups.map((g) => (
          <div key={g.label}>
            <div className="text-[0.7rem] uppercase tracking-wider text-muted mb-1">{g.label}</div>
            <ul className="space-y-1">
              {g.rows.map((r) => (
                <li key={r.name} className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate">{r.name}{r.sub && <span className="block text-[0.7rem] text-muted">{r.sub}</span>}</span>
                  <span className={`money ${r.value < 0 ? "text-bad" : ""}`}>{fmtUSD(r.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {profile.bills.length > 0 && (
        <div className="mt-4 text-xs text-muted">
          Recurring: {profile.bills.filter((b) => b.status === "recurring").map((b) => `${b.payee} ${fmtUSD(b.amount)}`).join(" · ")}
        </div>
      )}
    </Card>
  );
}
