"use client";
import { useState } from "react";
import { Bar, Panel, Tile, fmtDate, fmtMonth, fmtSigned } from "@/components/nova/ui";
import { CarSpinner } from "@/components/CarSpinner";
import { extraPaymentPlan, recentScheduledPayments } from "@/lib/bank/borrowing";
import type { LoanStats } from "@/lib/bank/view";
import type { Car, Contract } from "@/lib/engine/types";
import { fmtUSD, type Cents } from "@/lib/money";
import { DollarSlider } from "./MoneyInput";
import { LegendRow, SplitBar } from "./SplitBar";

const EXTRA_MAX_DOLLARS = 500;
const EXTRA_STEP_DOLLARS = 10;
const EXTRA_DEFAULT: Cents = 5_000;
const RECENT_COUNT = 3;

export function CarSummary({ car, contract, autopay }: { car: Car; contract: Contract; autopay: boolean }) {
  return (
    <Panel>
      <div className="rounded-xl bg-surface-2 overflow-hidden"><CarSpinner model={car.model} year={car.year} /></div>
      <h2 className="font-semibold text-lg mt-3">{car.year} Toyota {car.model} {car.trim}</h2>
      <dl className="mt-2 grid grid-cols-[5rem_1fr] gap-y-1 text-sm">
        <dt className="text-muted">Lender</dt><dd>Toyota Financial Services</dd>
        <dt className="text-muted">{contract.type === "lease" ? "Lease" : "Loan"}</dt>
        <dd>{contract.termMonths} months{contract.contractStart ? ` · started ${fmtMonth(contract.contractStart)}` : ""}</dd>
        <dt className="text-muted">Autopay</dt><dd>{autopay ? "On" : "Off"}</dd>
      </dl>
    </Panel>
  );
}

export function LoanTiles({ car, contract }: { car: Car; contract: Contract }) {
  return (
    <Panel>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Tile label="Market value" value={fmtUSD(car.marketValue)} note="Estimate for today" />
        {car.purchasePrice !== undefined && <Tile label="Price you paid" value={fmtUSD(car.purchasePrice)} note={contract.contractStart ? fmtMonth(contract.contractStart) : undefined} />}
        {contract.amountFinanced !== undefined && <Tile label="Financing amount" value={fmtUSD(contract.amountFinanced)} note="What you borrowed" />}
        <Tile dark label="Payment left" value={fmtUSD(contract.payoffQuote)} note="To pay it off today" />
        <Tile label="Equity" value={fmtSigned(contract.estEquity)} note="Market value − payment left" />
        {contract.aprPct !== undefined && <Tile label="Rate and term" value={`${contract.aprPct}% APR`} note={`${contract.termMonths} months`} />}
      </div>
    </Panel>
  );
}

export function PaymentsPanel({ contract, loan }: { contract: Contract; loan: LoanStats }) {
  return (
    <Panel title="Payments">
      <p className="text-sm"><span className="text-3xl font-semibold">{loan.paymentsMade}</span> of {contract.termMonths} made · {loan.paymentsLeft} left</p>
      <div className="my-3"><Bar pct={loan.pctPaid} /></div>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div><div className="text-xs text-muted">Monthly</div><div className="font-semibold money">{fmtUSD(contract.monthlyPayment)}</div></div>
        <div><div className="text-xs text-muted">Next payment</div><div className="font-semibold">{fmtDate(loan.nextPaymentDate, true)}</div></div>
        <div><div className="text-xs text-muted">Paid off</div><div className="font-semibold">{fmtMonth(loan.paidOffDate)}</div></div>
      </div>
      <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">Interest still ahead if you pay on schedule: <b className="money">{fmtUSD(loan.interestAhead)}</b></p>
    </Panel>
  );
}

export function PaidSoFarPanel({ contract, loan }: { contract: Contract; loan: LoanStats }) {
  return (
    <Panel title="Paid so far">
      <div className="text-3xl font-semibold money">{fmtUSD(loan.totalPaid)}</div>
      <div className="my-3"><SplitBar principal={loan.principalPaid} interest={loan.interestPaid} /></div>
      <LegendRow label="Car only (principal)" cents={loan.principalPaid} />
      <LegendRow label="Interest only" cents={loan.interestPaid} hatched />
      <p className="text-xs text-muted mt-2">
        Total interest over the whole loan, on schedule: {fmtUSD(loan.interestPaid + loan.interestAhead)}
        {contract.amountFinanced === undefined && " · split estimated (original amount financed not on file)"}
      </p>
    </Panel>
  );
}

export function PayFasterPanel({ contract, loan }: { contract: Contract; loan: LoanStats }) {
  const [extra, setExtra] = useState<Cents>(EXTRA_DEFAULT);
  const plan = extraPaymentPlan({ balance: contract.balance, aprPct: contract.aprPct ?? 0, monthly: contract.monthlyPayment, extra, nextPaymentDate: loan.nextPaymentDate });
  return (
    <Panel title="Pay it off faster">
      <DollarSlider id="extra-monthly" label="Extra each month" cents={extra} max={EXTRA_MAX_DOLLARS} step={EXTRA_STEP_DOLLARS} onChange={setExtra} />
      <div className="grid grid-cols-3 gap-2 mt-3">
        <Tile label="Paid off" value={fmtMonth(plan.paidOffDate)} />
        <Tile label="Time saved" value={`${plan.monthsSaved} mo`} />
        <Tile label="Interest saved" value={fmtUSD(plan.interestSaved)} />
      </div>
      <p className="text-xs text-muted mt-3">
        Next step: ask Toyota Financial Services to apply the extra amount to principal. OneFlow can&apos;t send loan payments to TFS from here yet, so nothing is scheduled by this slider.
      </p>
    </Panel>
  );
}

export function RecentPaymentsPanel({ contract, loan }: { contract: Contract; loan: LoanStats }) {
  const rows = recentScheduledPayments({ balance: contract.balance, aprPct: contract.aprPct ?? 0, monthly: contract.monthlyPayment, paymentsMade: loan.paymentsMade, nextPaymentDate: loan.nextPaymentDate, count: RECENT_COUNT });
  return (
    <Panel title="Recent payments" subtitle="Scheduled payments, split rebuilt from your loan terms">
      {rows.length === 0 && <p className="text-sm text-muted">No payments made yet.</p>}
      {rows.map((r) => (
        <div key={r.number} className="flex items-center justify-between py-2 border-b border-line last:border-0">
          <div>
            <div className="text-sm font-semibold">{fmtDate(r.date)} · payment {r.number} <span className="chip ml-1">Scheduled</span></div>
            <div className="text-xs text-muted money">{fmtUSD(r.principal)} car + {fmtUSD(r.interest)} interest</div>
          </div>
          <div className="text-sm font-semibold money">{fmtUSD(r.amount)}</div>
        </div>
      ))}
    </Panel>
  );
}

export function RecallBanner({ car }: { car: Car }) {
  if (!car.openRecall) return null;
  return (
    <div role="alert" className="panel p-4 mb-4 border-warn">
      <b>Open recall on your {car.model}.</b> <span className="text-sm text-muted">Book a free fix at a Toyota dealer. Next service due {fmtDate(car.nextServiceDue, true)}.</span>
    </div>
  );
}
