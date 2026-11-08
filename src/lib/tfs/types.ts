import type { RankedMove } from "@/lib/engine/moves/rank";
import type { Cents, Profile } from "@/lib/engine/types";

/** Portfolio shapes and bucket names, safe to import from client components (no engine code). */
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
