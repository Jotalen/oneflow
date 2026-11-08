"use client";
import { useMemo, useState, type ReactNode } from "react";
import { Panel, Segmented, Tile, fmtSigned } from "@/components/nova/ui";
import { financeOptions } from "@/lib/bank/borrowing";
import type { BankView } from "@/lib/bank/view";
import type { Contract, Profile } from "@/lib/engine/types";
import { fmtUSD, type Cents } from "@/lib/money";
import { MoneyInput } from "./MoneyInput";
import { RateTable } from "./RateTable";
import { useRates } from "./useRates";
import { LeaseOptions } from "./LeaseOptions";

type Sub = "finance" | "lease" | "refi";
const DOWN_SHARE = 0.1;
const ROUND_TO: Cents = 50_000;
const NO_CONTRACT_TARGET_SHARE = 0.1;
const FOOTNOTE = "Rates from the Toyota Financial Services hackathon rate sheet. Real offers need a credit check.";

/** What the current car is worth toward a new one: loan = market value − payoff; lease = TFS equity estimate. */
function tradeEquity(p: Profile): Cents | null {
  if (!p.car || !p.contract) return null;
  return p.contract.type === "lease" ? p.contract.estEquity : p.car.marketValue - p.contract.payoffQuote;
}

export function ShopFinance({ profile, view }: { profile: Profile; view: BankView }) {
  const startPrice = profile.car ? profile.car.purchasePrice ?? profile.car.marketValue : 3_000_000;
  const [model, setModel] = useState(profile.car ? `${profile.car.year + 1} Toyota ${profile.car.model}` : "");
  const [price, setPrice] = useState<Cents>(Math.round(startPrice / ROUND_TO) * ROUND_TO);
  const [down, setDown] = useState<Cents>(Math.round((startPrice * DOWN_SHARE) / ROUND_TO) * ROUND_TO);
  const equity = tradeEquity(profile);
  const [trade, setTrade] = useState(equity !== null);
  const [sub, setSub] = useState<Sub>("finance");
  const { rates, loading, error } = useRates();

  const used = trade && equity !== null ? equity : 0;
  const amount = Math.max(0, price - down - used);
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
          <div className="grid gap-3 sm:grid-cols-3">
            <label htmlFor="shop-model" className="block">
              <span className="text-xs font-semibold">Car you&apos;re looking at</span>
              <input id="shop-model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. Toyota Camry LE" className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-fg/50" />
            </label>
            <MoneyInput id="shop-price" label="Price" cents={price} onChange={setPrice} />
            <MoneyInput id="shop-down" label="Down payment" cents={down} onChange={setDown} />
          </div>
          {equity !== null && profile.car && profile.contract && (
            <label className="mt-3 flex gap-3 rounded-xl border border-line p-3 text-sm cursor-pointer">
              <input type="checkbox" checked={trade} onChange={(e) => setTrade(e.target.checked)} className="mt-0.5" />
              <span>
                <b>Trade in my {profile.car.year} {profile.car.model}</b>
                <span className="block text-xs text-muted">
                  {profile.contract.type === "lease"
                    ? `TFS estimates ${fmtSigned(equity)} of lease equity toward the new car`
                    : `Worth about ${fmtUSD(profile.car.marketValue)}, you owe ${fmtUSD(profile.contract.payoffQuote)}, ${equity >= 0 ? `so ${fmtUSD(equity)} goes toward the new car` : `so ${fmtUSD(-equity)} gets added to the new loan`}`}
                </span>
              </span>
            </label>
          )}
          <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="text-muted money">{fmtUSD(price)} − {fmtUSD(down)} down{trade && equity !== null ? (equity >= 0 ? ` − ${fmtUSD(equity)} trade-in` : ` + ${fmtUSD(-equity)} owed on trade-in`) : ""}</span>
            <span>Amount to finance <b className="text-2xl money">{fmtUSD(amount)}</b></span>
          </div>
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
