"use client";
import { Bar, Panel, Tile } from "@/components/nova/ui";
import { fmtUSD } from "@/lib/money";
import { EFFORT_BUCKETS, NEXT_STEP_BUCKETS, type Portfolio, type PortfolioRow } from "@/lib/tfs/types";

const pctOf = (n: number, of: number) => (of > 0 ? (n / of) * 100 : 0);

/** All 20 TFS customers from Toyota's side (VALUE pillar). Displays engine + pack numbers; computes no new ones. */
export function PortfolioView({ portfolio }: { portfolio: Portfolio }) {
  const { totals, rows, assumptions } = portfolio;
  return (
    <div className="space-y-4">
      <Headline portfolio={portfolio} />
      <div className="grid gap-4 lg:grid-cols-2">
        <NextStepMix totals={totals} />
        <EffortMix totals={totals} />
      </div>
      <Panel title="Customers" subtitle="Our engine's top move for each customer, next to Toyota's reference answer">
        <ul className="divide-y divide-line">{rows.map((r) => <CustomerRow key={r.customerId} row={r} />)}</ul>
      </Panel>
      <Panel title="How these numbers are made">
        <ul className="text-xs text-muted space-y-1 list-disc pl-4">{assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
      </Panel>
    </div>
  );
}

function Headline({ portfolio: { totals } }: { portfolio: Portfolio }) {
  const { expectedValue: ev, guardrails: g } = totals;
  const share = Math.round(pctOf(ev.matched, ev.reference));
  return (
    <Panel title={`TFS portfolio · ${totals.customers} customers`} subtitle="Every customer in the Toyota data pack, seen from Toyota Financial Services. Synthetic data.">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="Expected value captured" value={fmtUSD(ev.matched)} note={`Estimate: ${share}% of the pack's ${fmtUSD(ev.reference)}, on ${ev.matchedCustomers} matched moves`} />
        <Tile label="Match TFS reference" value={`${totals.goldenMatches} of ${totals.customers}`} note="Top move equals golden_answers.csv" />
        <Tile label="Self-service next step" value={`${totals.nextStep["Self-service"]} of ${totals.customers}`} note="Done in the app, no call needed" />
        <Tile label="Sales offers withheld" value={g.withheldOffers} note={`${g.humanHandoffs} vulnerable customers get a person, not a pitch`} />
      </div>
    </Panel>
  );
}

function NextStepMix({ totals }: { totals: Portfolio["totals"] }) {
  return (
    <Panel title="Next step mix" subtitle="What each customer is guided to do">
      <ul className="space-y-2 text-sm">
        {NEXT_STEP_BUCKETS.map((b) => (
          <li key={b}>
            <div className="flex justify-between gap-3"><span>{b === "Human" ? "Human specialist" : b}</span><span className="money font-semibold">{totals.nextStep[b]}</span></div>
            <Bar pct={pctOf(totals.nextStep[b], totals.customers)} tone={b === "Human" ? "muted" : "ink"} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function EffortMix({ totals }: { totals: Portfolio["totals"] }) {
  const mixes = [{ label: "Our top moves", mix: totals.effort }, { label: "TFS reference", mix: totals.referenceEffort }];
  return (
    <Panel title="Service effort" subtitle="Effort per move, from offers_catalog.csv (customers per level)">
      <div className="grid grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))] gap-x-2 gap-y-1.5 text-sm">
        <span />
        {EFFORT_BUCKETS.map((b) => <span key={b} className="text-[0.7rem] text-muted text-right">{b}</span>)}
        {mixes.map(({ label, mix }) => [
          <span key={label} className="text-xs">{label}</span>,
          ...EFFORT_BUCKETS.map((b) => <span key={`${label}-${b}`} className="money font-semibold text-right">{mix[b]}</span>),
        ])}
      </div>
      <p className="text-xs text-muted mt-3">Our human handoffs are all &quot;High&quot; effort on purpose: the guardrails send vulnerable customers to a person.</p>
    </Panel>
  );
}

function CustomerRow({ row: r }: { row: PortfolioRow }) {
  const guarded = r.guardrail.humanHandoff || r.guardrail.noNewVehicleOffers;
  return (
    <li className="py-3 text-sm min-w-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold">{r.name}</span>
        <span className="text-xs text-muted">{r.customerId}</span>
        {r.contractType && <span className="chip capitalize">{r.contractType}</span>}
        {r.vehicle && <span className="text-xs text-muted">{r.vehicle}</span>}
        <span className="ml-auto"><RowValue row={r} /></span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="min-w-0 break-words">{r.topMove ? r.topMove.title : "No TFS move"}</span>
        {r.nextStep && <span className="chip">{r.nextStep === "Human" ? "Human specialist" : r.nextStep}</span>}
        {r.goldenMatch && <span className="chip text-good" title="Top move equals Toyota's reference answer">✓ matches TFS reference</span>}
      </div>
      {!r.goldenMatch && r.reference && <p className="text-xs text-muted mt-1 break-words">TFS reference: {r.reference.move} ({r.reference.nextStepType})</p>}
      {guarded && (
        <p className="text-xs text-warn mt-1 break-words">
          Guardrail: {r.guardrail.reasons.join("; ")}.
          {r.withheldOptionIds.length > 0 && ` Not shown to the customer: ${r.withheldOptionIds.join(", ")}.`}
        </p>
      )}
    </li>
  );
}

function RowValue({ row: r }: { row: PortfolioRow }) {
  if (r.expectedValue === null) return <span className="text-xs text-muted" title="No expected value in golden_answers.csv">—</span>;
  if (r.goldenMatch) return <span className="money font-semibold text-good" title="golden_answers.csv expected value (estimate)">{fmtUSD(r.expectedValue)}</span>;
  return <span className="text-xs text-muted" title="The pack prices only its reference move, so this is not counted">— <span className="line-through">{fmtUSD(r.expectedValue)}</span> not counted</span>;
}
