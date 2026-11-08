"use client";
import { Bar, Panel, Tile, fmtMonth, fmtSigned } from "@/components/nova/ui";
import { leasePace } from "@/lib/bank/borrowing";
import { addMonths, nextDueDate } from "@/lib/bank/view";
import type { Car, Contract } from "@/lib/engine/types";
import { fmtUSD } from "@/lib/money";

const miles = (n: number) => `${n.toLocaleString("en-US")} mi`;

export function LeaseTiles({ car, contract }: { car: Car; contract: Contract }) {
  return (
    <Panel>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Tile label="Market value" value={fmtUSD(car.marketValue)} note="Estimate for today" />
        {contract.residual !== undefined && <Tile label="Buyout price" value={fmtUSD(contract.residual)} note="Residual at lease end" />}
        <Tile label="Monthly" value={fmtUSD(contract.monthlyPayment)} note={`${contract.termMonths}-month lease`} />
        <Tile dark label="Payment left" value={fmtUSD(contract.payoffQuote)} note="To end the lease today" />
        <Tile label="Equity" value={fmtSigned(contract.estEquity)} note="TFS estimate" />
        {contract.leaseEndFees !== undefined && <Tile label="Lease-end fees" value={fmtUSD(contract.leaseEndFees)} note="If you return it" />}
      </div>
    </Panel>
  );
}

export function LeaseTimePanel({ contract }: { contract: Contract }) {
  const end = addMonths(nextDueDate(contract.dueDay), contract.monthsRemaining - 1);
  const pct = contract.termMonths ? (contract.monthsElapsed / contract.termMonths) * 100 : 0;
  return (
    <Panel title="Lease term">
      <p className="text-sm"><span className="text-3xl font-semibold">{contract.monthsRemaining}</span> months left of {contract.termMonths}</p>
      <div className="my-3"><Bar pct={pct} /></div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div><div className="text-xs text-muted">Lease ends</div><div className="font-semibold">{fmtMonth(end)}</div></div>
        <div><div className="text-xs text-muted">Monthly</div><div className="font-semibold money">{fmtUSD(contract.monthlyPayment)}</div></div>
      </div>
    </Panel>
  );
}

export function MileagePanel({ car, contract }: { car: Car; contract: Contract }) {
  if (contract.mileageAllowance === undefined) return <Panel title="Mileage"><p className="text-sm text-muted">No mileage allowance on file for this lease.</p></Panel>;
  const pace = leasePace({ odometer: car.odometer, annualMilesEst: car.annualMilesEst, monthsRemaining: contract.monthsRemaining, allowance: contract.mileageAllowance });
  return (
    <Panel title="Mileage" subtitle={`About ${car.annualMilesEst.toLocaleString("en-US")} miles a year (estimate)`}>
      <div className="flex items-baseline justify-between text-sm"><span>{miles(car.odometer)} driven</span><span className="text-muted">of {miles(contract.mileageAllowance)} allowed</span></div>
      <div className="my-3"><Bar pct={pace.pctOfAllowance} tone={pace.overBy > 0 ? "bad" : "ink"} /></div>
      <p className="rounded-xl bg-surface-2 p-3 text-sm">
        At this pace you&apos;ll be at about <b>{miles(pace.projectedMiles)}</b> when the lease ends:{" "}
        {pace.overBy > 0 ? <b className="text-bad">{miles(pace.overBy)} over</b> : <b>{miles(pace.underBy)} under</b>} the allowance.
      </p>
    </Panel>
  );
}
