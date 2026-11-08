"use client";
import type { Profile } from "@/lib/engine/types";
import { fmtUSD } from "@/lib/money";
import { Card } from "./ui/Card";
import { CarSpinner } from "./CarSpinner";


export function CarCard({ profile }: { profile: Profile }) {
  const { car, contract } = profile;
  if (!car || !contract) return null;
  const isLease = contract.type === "lease";
  const allowanceToDate = contract.mileageAllowance ? Math.round((contract.mileageAllowance * contract.monthsElapsed) / contract.termMonths) : null;
  const pacePct = contract.mileageAllowance ? Math.min(150, Math.round((car.odometer / contract.mileageAllowance) * 100)) : null;
  const overBy = allowanceToDate !== null ? car.odometer - allowanceToDate : null;
  return (
    <Card
      eyebrow={isLease ? "Your Toyota · lease" : "Your Toyota · loan"}
      title={`${car.year} ${car.model} ${car.trim}`}
      right={car.openRecall ? <span className="chip text-bad">Open recall</span> : <span className="chip">{contract.monthsRemaining} mo left</span>}
    >
      <div className="grid md:grid-cols-[1.4fr_1fr] gap-4 items-center">
        <CarSpinner model={car.model} year={car.year} />
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-[0.7rem] uppercase tracking-wider text-muted">Est. value</dt><dd className="money font-semibold">{fmtUSD(car.marketValue)}</dd></div>
          <div><dt className="text-[0.7rem] uppercase tracking-wider text-muted">{isLease ? "Buyout quote" : "Payoff"}</dt><dd className="money font-semibold">{fmtUSD(contract.payoffQuote)}</dd></div>
          <div><dt className="text-[0.7rem] uppercase tracking-wider text-muted">Equity</dt><dd className={`money font-semibold ${contract.estEquity >= 0 ? "text-good" : "text-bad"}`}>{fmtUSD(contract.estEquity)}</dd></div>
          <div><dt className="text-[0.7rem] uppercase tracking-wider text-muted">Payment</dt><dd className="money font-semibold">{fmtUSD(contract.monthlyPayment)}/mo{contract.aprPct ? ` · ${contract.aprPct}%` : ""}</dd></div>
          <div><dt className="text-[0.7rem] uppercase tracking-wider text-muted">Toyota Care ends</dt><dd>{car.toyotaCareEnds}</dd></div>
          <div><dt className="text-[0.7rem] uppercase tracking-wider text-muted">Next service</dt><dd>{car.nextServiceDue}</dd></div>
        </dl>
      </div>
      {isLease && pacePct !== null && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-muted mb-1">
            <span>Mileage pace · {car.odometer.toLocaleString()} of {contract.mileageAllowance!.toLocaleString()} mi allowed</span>
            <span className={overBy! > 0 ? "text-bad" : "text-good"}>{overBy! > 0 ? `${overBy!.toLocaleString()} mi over pace` : "on pace"}</span>
          </div>
          <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
            <div className={`h-full ${pacePct > 100 ? "bg-bad" : pacePct > 85 ? "bg-warn" : "bg-good"}`} style={{ width: `${Math.min(100, pacePct)}%` }} />
          </div>
        </div>
      )}
      {car.openRecall && <p className="mt-3 text-sm text-bad">Open safety recall on file. Service first; it is free.</p>}
    </Card>
  );
}
