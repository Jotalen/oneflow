import { guardrails } from "@/lib/engine/guardrails";
import { isEligibleOption } from "@/lib/engine/moves/car";
import { topTfsMove, type RankedMove } from "@/lib/engine/moves/rank";
import type { Cents, Move, Profile } from "@/lib/engine/types";
import type { ToyotaData } from "@/lib/toyota/types";

export type NextStepBucket = "Self-service" | "Follow-up" | "Offer" | "Human";
export type EffortBucket = "Very low" | "Low" | "Medium" | "High";
export type PortfolioSource = "snapshot" | "synthetic";

export const NEXT_STEP_BUCKETS: readonly NextStepBucket[] = ["Self-service", "Follow-up", "Offer", "Human"];
export const EFFORT_BUCKETS: readonly EffortBucket[] = ["Very low", "Low", "Medium", "High"];

export interface PortfolioInput { profile: Profile; ranked: RankedMove[]; source: PortfolioSource }

export interface PortfolioRow {
  customerId: string;
  name: string;
  contractType: "loan" | "lease" | null;
  vehicle: string | null;
  source: PortfolioSource;
  topMove: { optionId: string; title: string } | null;
  nextStep: NextStepBucket | null;
  /** Straight from rankMoves: never re-derived here. */
  goldenMatch: boolean;
  reference: { offerId: string; move: string; nextStepType: string } | null;
  guardrail: { humanHandoff: boolean; noNewVehicleOffers: boolean; reasons: string[] };
  /** Eligible TFS options (option_scenarios) the guardrails kept out of the customer's moves. */
  withheldOptionIds: string[];
  /** Of those, the ones offers_catalog lists as next_step_type "Offer" (sales offers). */
  withheldOfferIds: string[];
  effort: EffortBucket | null;
  referenceEffort: EffortBucket | null;
  /** golden_answers.csv expected_value_usd (value_if_completed × assumed_take_rate), cents. */
  expectedValue: Cents | null;
  valueIfCompleted: Cents | null;
  takeRate: number | null;
}

export interface PortfolioTotals {
  customers: number;
  goldenMatches: number;
  nextStep: Record<NextStepBucket, number>;
  expectedValue: { reference: Cents; matched: Cents; matchedCustomers: number };
  guardrails: { customersProtected: number; humanHandoffs: number; noConsent: number; withheldOptions: number; withheldOffers: number };
  effort: Record<EffortBucket, number>;
  referenceEffort: Record<EffortBucket, number>;
}

export interface Portfolio { rows: PortfolioRow[]; totals: PortfolioTotals; assumptions: string[] }

export const PORTFOLIO_ASSUMPTIONS: readonly string[] = [
  "Synthetic data: the Toyota hackathon pack, not real TFS customers or pricing.",
  "Expected value = value if completed × assumed take rate, both from golden_answers.csv (dollar values from value_drivers.csv).",
  "The pack prices only its reference move. When our top move differs, its value is not counted.",
  "Service effort is the offers_catalog.csv label for the offer behind the move.",
  "Bank balances are each customer's bundled snapshot, re-run through the current engine. Live Nessie balances can differ.",
];

/** Map a move's next-step wording onto the four portfolio buckets; null when the wording is unknown. */
export function nextStepBucket(kind: Move["kind"], nextStepType: string): NextStepBucket | null {
  if (kind === "human") return "Human";
  if (/^self/i.test(nextStepType)) return "Self-service";
  if (/^follow/i.test(nextStepType)) return "Follow-up";
  if (/^offer/i.test(nextStepType)) return "Offer";
  return null;
}

/** Leading level of an offers_catalog service_effort label, e.g. "Low (digital)" → "Low". */
export function effortBucket(label: string | undefined): EffortBucket | null {
  if (!label) return null;
  if (/^very low/i.test(label)) return "Very low";
  if (/^low/i.test(label)) return "Low";
  if (/^medium/i.test(label)) return "Medium";
  if (/^high/i.test(label)) return "High";
  return null;
}

type Pack = Pick<ToyotaData, "golden" | "offers">;

const offerOf = (t: Pack, id: string | undefined) => (id ? t.offers.find((o) => o.offer_id === id) : undefined);

/** Eligible options the engine's guardrails removed: eligible scenarios that did not become moves. */
function withheldOptions(p: Profile, ranked: RankedMove[]): string[] {
  if (!p.contract || !p.car) return [];
  const offered = new Set(ranked.filter((m) => m.kind === "car").map((m) => m.tfs?.optionId));
  return p.carOptions.filter((o) => o.option_id !== "KEEP" && isEligibleOption(o) && !offered.has(o.option_id)).map((o) => o.option_id);
}

function buildRow({ profile: p, ranked, source }: PortfolioInput, t: Pack): PortfolioRow {
  const top = topTfsMove(ranked);
  const golden = t.golden.find((g) => g.customer_id === p.personaId);
  const g = guardrails(p);
  const withheld = withheldOptions(p, ranked);
  return {
    customerId: p.personaId,
    name: p.name,
    contractType: p.contract?.type ?? null,
    vehicle: p.car ? `${p.car.year} ${p.car.model}` : null,
    source,
    topMove: top?.tfs ? { optionId: top.tfs.optionId, title: top.title } : null,
    nextStep: top?.tfs ? nextStepBucket(top.kind, top.tfs.nextStepType) : null,
    goldenMatch: top?.goldenMatch ?? false,
    reference: golden ? { offerId: golden.offer_id, move: golden.best_next_move, nextStepType: golden.next_step_type } : null,
    guardrail: { humanHandoff: g.humanHandoff, noNewVehicleOffers: g.noNewVehicleOffers, reasons: g.reasons },
    withheldOptionIds: withheld,
    withheldOfferIds: withheld.filter((id) => offerOf(t, id)?.next_step_type === "Offer"),
    effort: effortBucket(offerOf(t, top?.tfs?.optionId)?.service_effort),
    referenceEffort: effortBucket(offerOf(t, golden?.offer_id)?.service_effort),
    expectedValue: golden?.expected_value_usd ?? null,
    valueIfCompleted: golden?.value_if_completed_usd ?? null,
    takeRate: golden?.assumed_take_rate ?? null,
  };
}

function countBy<K extends string>(keys: readonly K[], values: (K | null)[]): Record<K, number> {
  const init = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  return values.reduce((acc, v) => (v ? { ...acc, [v]: acc[v] + 1 } : acc), init);
}

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

function buildTotals(rows: PortfolioRow[], t: Pack): PortfolioTotals {
  const matched = rows.filter((r) => r.goldenMatch);
  return {
    customers: rows.length,
    goldenMatches: matched.length,
    nextStep: countBy(NEXT_STEP_BUCKETS, rows.map((r) => r.nextStep)),
    expectedValue: {
      reference: sum(t.golden.map((g) => g.expected_value_usd ?? 0)),
      matched: sum(matched.map((r) => r.expectedValue ?? 0)),
      matchedCustomers: matched.length,
    },
    guardrails: {
      customersProtected: rows.filter((r) => r.guardrail.humanHandoff || r.guardrail.noNewVehicleOffers).length,
      humanHandoffs: rows.filter((r) => r.guardrail.humanHandoff).length,
      noConsent: rows.filter((r) => r.guardrail.noNewVehicleOffers).length,
      withheldOptions: sum(rows.map((r) => r.withheldOptionIds.length)),
      withheldOffers: sum(rows.map((r) => r.withheldOfferIds.length)),
    },
    effort: countBy(EFFORT_BUCKETS, rows.map((r) => r.effort)),
    referenceEffort: countBy(EFFORT_BUCKETS, rows.map((r) => r.referenceEffort)),
  };
}

/** Portfolio view from Toyota's side: per-customer engine outcome plus VALUE totals. Pure. */
export function buildPortfolio(inputs: PortfolioInput[], t: Pack): Portfolio {
  const rows = inputs.map((i) => buildRow(i, t));
  return { rows, totals: buildTotals(rows, t), assumptions: [...PORTFOLIO_ASSUMPTIONS] };
}
