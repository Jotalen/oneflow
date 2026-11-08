"use client";
import { useMemo, useState, type ReactNode } from "react";
import { Panel, Segmented, Tile } from "@/components/nova/ui";
import { amountToFinance, financeOptions, type CatalogCar } from "@/lib/bank/borrowing";
import type { BankView } from "@/lib/bank/view";
import type { Contract, Profile } from "@/lib/engine/types";
import { fmtUSD, type Cents } from "@/lib/money";
import { MoneyInput } from "./MoneyInput";
import { RateTable } from "./RateTable";
import { useRates } from "./useRates";
import { useCarModels } from "./useCarModels";
import { LeaseOptions } from "./LeaseOptions";
import { FinanceBreakdown, TradeInToggle, tradeInfo } from "./TradeIn";

type Sub = "finance" | "lease" | "refi";
const DOWN_SHARE = 0.1;
const ROUND_TO: Cents = 50_000;
const NO_CONTRACT_TARGET_SHARE = 0.1;
const FOOTNOTE = "Rates from the Toyota Financial Services hackathon rate sheet. Real offers need a credit check.";

const roundPrice = (c: Cents) => Math.round(c / ROUND_TO) * ROUND_TO;
const downFor = (price: Cents) => roundPrice(price * DOWN_SHARE);

/** Default pick: the same model and trim as the customer's car, if the data pack has it new. */
function defaultCar(cars: CatalogCar[], p: Profile): CatalogCar | undefined {
  return p.car ? cars.find((c) => c.model === p.car?.model && c.trim === p.car?.trim) : undefined;
}

export function ShopFinance({ profile, view }: { profile: Profile; view: BankView }) {
  const startPrice = profile.car ? profile.car.purchasePrice ?? profile.car.marketValue : 3_000_000;
  const catalog = useCarModels();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [price, setPrice] = useState<Cents>(roundPrice(startPrice));
  const [down, setDown] = useState<Cents>(downFor(startPrice));
  const trade = tradeInfo(profile.car, profile.contract);
  const [useTrade, setUseTrade] = useState(trade !== null);
  const [sub, setSub] = useState<Sub>("finance");
  const { rates, loading, error } = useRates();

  const selected = pickedId ? catalog.cars.find((c) => c.id === pickedId) : defaultCar(catalog.cars, profile);
  const pick = (car: CatalogCar) => { setPickedId(car.id); setPrice(car.price); setDown(downFor(car.price)); };
  const amount = amountToFinance({ price, down, tradeEquity: trade?.equity ?? null, useTrade });
  const target = profile.contract?.monthlyPayment ?? Math.round(profile.incomeMonthly * NO_CONTRACT_TARGET_SHARE);
  const tierLabel = rates.find((r) => r.credit_tier === profile.creditTier)?.tier_label;
  const isLoan = profile.contract?.type === "loan";
  const holdBack = profile.flags.vulnerable || !profile.flags.marketingConsent;

  const financeRows = useMemo(() => financeOptions({ amount, rates, tier: profile.creditTier, kind: "new", targetMonthly: target }), [amount, rates, profile.creditTier, target]);
  const refiAmount = profile.contract?.payoffQuote ?? 0;
  const refiRows = useMemo(() => (isLoan ? financeOptions({ amount: refiAmount, rates, tier: profile.creditTier, kind: "refi", targetMonthly: target }) : []), [isLoan, refiAmount, rates, profile.creditTier, target]);

  return (
    <>
      {holdBack && (
        <p className="panel p-4 mb-4 text-sm" role="note">
          {profile.flags.vulnerable
            ? "We're not suggesting a new car right now. The calculator still works, and a Toyota Financial Services specialist can talk through options with you."
            : "You haven't opted in to marketing, so we don't show new-vehicle offers. The calculator below uses the public rate sheet only."}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Panel title="Your next car">
          <CarPicker cars={catalog.cars} loading={catalog.loading} error={catalog.error} selectedId={selected?.id ?? ""} onPick={pick} />
          <div className="grid gap-3 grid-cols-2 mt-3">
            <MoneyInput id="shop-price" label="Price" cents={price} onChange={setPrice} />
            <MoneyInput id="shop-down" label="Down payment" cents={down} onChange={setDown} />
          </div>
          {trade && profile.car && <TradeInToggle car={profile.car} info={trade} checked={useTrade} onChange={setUseTrade} />}
          <FinanceBreakdown price={price} down={down} equity={useTrade && trade ? trade.equity : null} amount={amount} />
        </Panel>
        <Panel title="What fits you">
          <div className="space-y-3">
            <Tile label="Target payment" value={`Up to ${fmtUSD(target)}/mo`} note={profile.contract ? "About what you pay today" : "About 10% of your monthly income"} />
            <Tile label="Credit score used for rates (estimate)" value={`${view.credit.score} · ${view.credit.label}`} note={tierLabel ? `Toyota tier ${profile.creditTier}: ${tierLabel}` : `Toyota tier ${profile.creditTier}`} />
          </div>
        </Panel>
      </div>

      <div className="my-4">
        <Segmented<Sub> value={sub} onChange={setSub} options={[
          { value: "finance", label: "Finance" },
          { value: "lease", label: "Lease" },
          { value: "refi", label: "Refinance my current loan", disabled: !isLoan },
        ]} />
      </div>

      {sub === "finance" && (
        <Panel title={`Financing options for ${fmtUSD(amount)}`} right={<span className="text-xs text-muted">Sorted by total cost</span>}>
          <RatesBody loading={loading} error={error}><RateTable rows={financeRows} label="Toyota Financial Services" targetMonthly={target} /></RatesBody>
          <p className="text-xs text-muted mt-3">{FOOTNOTE}</p>
        </Panel>
      )}
      {sub === "refi" && isLoan && profile.contract && (
        <RefiPanel profile={profile} contract={profile.contract} rowsBody={<RatesBody loading={loading} error={error}><RateTable rows={refiRows} label="TFS refinance" targetMonthly={target} /></RatesBody>} />
      )}
      {sub === "lease" && <LeaseOptions profile={profile} holdBack={holdBack} />}
    </>
  );
}

interface CarPickerProps { cars: CatalogCar[]; loading: boolean; error: string | null; selectedId: string; onPick: (c: CatalogCar) => void }

/** Real Toyota models from the TFS data pack; picking one fills in its price. */
function CarPicker({ cars, loading, error, selectedId, onPick }: CarPickerProps) {
  return (
    <label htmlFor="shop-model" className="block">
      <span className="text-xs font-semibold">The car we&apos;re looking at</span>
      <select
        id="shop-model"
        value={selectedId}
        disabled={loading || cars.length === 0}
        onChange={(e) => { const car = cars.find((c) => c.id === e.target.value); if (car) onPick(car); }}
        className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-fg/50"
      >
        {selectedId === "" && <option value="">{loading ? "Loading Toyota models…" : "Choose a Toyota"}</option>}
        {cars.map((c) => <option key={c.id} value={c.id}>{c.label} · {fmtUSD(c.price)}</option>)}
      </select>
      {error && <span className="block text-xs text-bad mt-1" role="alert">Couldn&apos;t load the car list: {error}. Enter a price below.</span>}
      {!error && <span className="block text-xs text-muted mt-1">Models and prices from the Toyota Financial Services data pack. You can still edit the price.</span>}
    </label>
  );
}

function RatesBody({ loading, error, children }: { loading: boolean; error: string | null; children: ReactNode }) {
  if (loading) return <p className="text-sm text-muted">Loading the rate sheet…</p>;
  if (error) return <p className="text-sm text-bad" role="alert">Couldn&apos;t load the rate sheet: {error}</p>;
  return <>{children}</>;
}

function RefiPanel({ profile, contract: c, rowsBody }: { profile: Profile; contract: Contract; rowsBody: ReactNode }) {
  const refi = profile.carOptions.find((o) => o.option_id === "REFI");
  return (
    <Panel title={`Refinance ${fmtUSD(c.payoffQuote)}`} subtitle={`Today: ${fmtUSD(c.monthlyPayment)}/mo at ${c.aprPct ?? "?"}% APR, ${c.monthsRemaining} payments left (${fmtUSD(c.monthlyPayment * c.monthsRemaining)} still to pay)`} right={<span className="text-xs text-muted">Sorted by total cost</span>}>
      {refi && (
        <p className="rounded-xl bg-surface-2 p-3 text-sm mb-3">
          <b>Toyota Financial Services says: </b>{refi.eligibility === "Y" ? "you're eligible." : refi.eligibility}{" "}
          <span className="text-muted">{refi.plain_language_summary}</span>
        </p>
      )}
      {rowsBody}
      <p className="text-xs text-muted mt-3">{FOOTNOTE}</p>
    </Panel>
  );
}
