"use client";
import { useState } from "react";
import { Panel, Segmented, Tile } from "@/components/nova/ui";
import { affordability, HOUSING_RATIO } from "@/lib/bank/borrowing";
import { fmtUSD, type Cents } from "@/lib/money";
import { MoneyInput } from "./MoneyInput";
import { LegendRow, SplitBar } from "./SplitBar";

const DEFAULT_PRICE: Cents = 30_000_000;
const DEFAULT_DOWN: Cents = 3_000_000;
const DEFAULT_RATE = 6.5;
const MAX_RATE = 25;
type Term = "30" | "15";

/** "What could you afford?" Principal and interest only; an estimate, not an offer. */
export function HouseCalculator({ incomeMonthly }: { incomeMonthly: Cents }) {
  const [price, setPrice] = useState<Cents>(DEFAULT_PRICE);
  const [down, setDown] = useState<Cents>(DEFAULT_DOWN);
  const [rateText, setRateText] = useState(String(DEFAULT_RATE));
  const [term, setTerm] = useState<Term>("30");
  const parsed = Number(rateText);
  const rate = Number.isFinite(parsed) ? Math.min(MAX_RATE, Math.max(0, parsed)) : DEFAULT_RATE;
  const a = affordability({ price, down, aprPct: rate, termYears: Number(term), incomeMonthly });
  const pct = Math.round(HOUSING_RATIO * 100);

  return (
    <div className="grid gap-4 lg:grid-cols-2 mt-4">
      <Panel title="What could you afford?" subtitle="An estimate from your income on file. Not an offer.">
        <div className="grid gap-3 sm:grid-cols-2">
          <MoneyInput id="house-price" label="Home price" cents={price} onChange={setPrice} />
          <MoneyInput id="house-down" label="Down payment" cents={down} onChange={setDown} />
          <label htmlFor="house-rate" className="block">
            <span className="text-xs font-semibold">Rate (APR %)</span>
            <input id="house-rate" inputMode="decimal" value={rateText} onChange={(e) => setRateText(e.target.value.replace(/[^0-9.]/g, ""))} className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-fg/50" />
          </label>
          <div>
            <span className="text-xs font-semibold block mb-1">Term</span>
            <Segmented<Term> size="sm" value={term} onChange={setTerm} options={[{ value: "30", label: "30 years" }, { value: "15", label: "15 years" }]} />
          </div>
        </div>
        <div className={`mt-4 rounded-xl p-3 text-sm ${a.fits ? "bg-surface-2" : "border border-bad"}`} role="status">
          <b className="money">{fmtUSD(a.monthly)}/mo</b> principal and interest is {a.ratioPct}% of your {fmtUSD(incomeMonthly)} monthly income.{" "}
          {a.fits ? `That's within the common ${pct}% guideline (${fmtUSD(a.limit)}/mo).` : <span className="text-bad">{`That's over the common ${pct}% guideline (${fmtUSD(a.limit)}/mo).`}</span>}
        </div>
        <p className="text-xs text-muted mt-2">Taxes, insurance, HOA and mortgage insurance are not included, so a real payment would be higher.</p>
      </Panel>
      <Panel title="If you bought at this price">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Tile label="Market value" value={fmtUSD(price)} note="The price you entered" />
          <Tile label="Financing amount" value={fmtUSD(a.financed)} note="What you'd borrow" />
          <Tile dark label="Payment left" value={fmtUSD(a.financed)} note="On day one" />
          <Tile label="Payments" value={`${Number(term) * 12}`} note={`${fmtUSD(a.monthly)} each`} />
          <Tile label="Rate and term" value={`${rate}%`} note={`${term} years fixed`} />
          <Tile label="Total of payments" value={fmtUSD(a.totalPayments)} />
        </div>
        <h3 className="text-sm font-semibold mt-4 mb-2">Over the whole loan</h3>
        <SplitBar principal={a.financed} interest={a.totalInterest} />
        <div className="mt-2">
          <LegendRow label="House only (principal)" cents={a.financed} />
          <LegendRow label="Interest only" cents={a.totalInterest} hatched />
        </div>
      </Panel>
    </div>
  );
}
