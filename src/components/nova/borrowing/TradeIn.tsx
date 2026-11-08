"use client";
import { fmtSigned } from "@/components/nova/ui";
import type { Car, Contract } from "@/lib/engine/types";
import { fmtUSD, type Cents } from "@/lib/money";

export interface TradeInfo { value: Cents | null; payoff: Cents | null; equity: Cents }

/** Loan: market value − payoff quote. Lease: TFS's lease-equity estimate (the car isn't yours to value). */
export function tradeInfo(car: Car | undefined, contract: Contract | undefined): TradeInfo | null {
  if (!car || !contract) return null;
  if (contract.type === "lease") return { value: null, payoff: null, equity: contract.estEquity };
  return { value: car.marketValue, payoff: contract.payoffQuote, equity: car.marketValue - contract.payoffQuote };
}

/** Checkbox with the equity math spelled out, so a negative trade-in doesn't read as a bug. */
export function TradeInToggle({ car, info, checked, onChange }: { car: Car; info: TradeInfo; checked: boolean; onChange: (v: boolean) => void }) {
  const owed = info.equity < 0;
  return (
    <label className="mt-3 flex gap-3 rounded-xl border border-line p-3 text-sm cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5" />
      <span>
        <b>Trade in my {car.year} {car.model}</b>
        <span className="block text-xs text-muted money">
          {info.value !== null && info.payoff !== null
            ? <>Trade-in value {fmtUSD(info.value)} − loan payoff {fmtUSD(info.payoff)} = equity <b className="text-fg">{fmtSigned(info.equity)}</b></>
            : <>Toyota Financial Services estimates your lease equity at <b className="text-fg">{fmtSigned(info.equity)}</b></>}
        </span>
        <span className="block text-xs text-muted mt-0.5">
          {owed
            ? `You owe ${fmtUSD(-info.equity)} more than the car is worth, so it's added to the new loan.`
            : `That ${fmtUSD(info.equity)} lowers the amount you finance.`}
        </span>
      </span>
    </label>
  );
}

/** price − down payment − equity = amount to finance, one line each. */
export function FinanceBreakdown({ price, down, equity, amount }: { price: Cents; down: Cents; equity: Cents | null; amount: Cents }) {
  return (
    <dl className="mt-4 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm money" aria-label="Amount to finance breakdown">
      <dt className="text-muted">Price</dt><dd className="text-right">{fmtUSD(price)}</dd>
      <dt className="text-muted">− Down payment</dt><dd className="text-right">{fmtUSD(down)}</dd>
      {equity !== null && (equity >= 0
        ? <><dt className="text-muted">− Trade-in equity</dt><dd className="text-right">{fmtUSD(equity)}</dd></>
        : <><dt className="text-muted">+ Owed on trade-in</dt><dd className="text-right">{fmtUSD(-equity)}</dd></>)}
      <div className="col-span-2 mt-1 flex items-baseline justify-between gap-4 border-t border-line pt-1">
        <dt className="font-semibold">= Amount to finance</dt>
        <dd className="text-2xl font-semibold">{fmtUSD(amount)}</dd>
      </div>
    </dl>
  );
}
