import { z } from "zod";
import { parseCents } from "@/lib/money";

/** CSV cells arrive as strings. These helpers coerce at the boundary. */
const str = z.string().trim();
const num = z.preprocess((v) => {
  const s = String(v ?? "").trim();
  if (s === "" || s.toLowerCase() === "n/a") return null;
  const n = Number(s.replace(/[%,]/g, ""));
  return Number.isFinite(n) ? n : null;
}, z.number().nullable());
const numReq = num.pipe(z.number());
const cents = z.preprocess(parseCents, z.number().int().nullable());
const centsReq = cents.pipe(z.number().int());
const yn = z.preprocess((v) => String(v ?? "").trim().toUpperCase(), z.enum(["Y", "N"]));

export const ToyotaCustomer = z.object({
  customer_id: str,
  payday_day: numReq,
  first_name: str,
  age: numReq,
  city: str,
  state: str,
  occupation: str,
  annual_income: centsReq,
  credit_tier_at_origination: str,
  credit_tier_now: str,
  other_monthly_debt: centsReq,
  tenure_months_with_tfs: numReq,
  autopay: yn,
  digital_engagement: str,
  preferred_channel: str,
  marketing_consent: yn,
  vulnerable_flag: yn,
  payment_to_income_pct: numReq,
  debt_to_income_pct: numReq,
  financial_stress_score: numReq,
});
export type ToyotaCustomer = z.infer<typeof ToyotaCustomer>;

export const ToyotaVehicle = z.object({
  vehicle_id: str,
  customer_id: str,
  model_year: numReq,
  model: str,
  trim: str,
  condition_at_purchase: str,
  purchase_price_or_msrp: centsReq,
  odometer_now: numReq,
  annual_miles_est: numReq,
  est_market_value_now: centsReq,
  toyota_care_ends: str,
  basic_warranty_ends: str,
  last_service_date: str,
  next_service_due: str,
  open_recall: str,
});
export type ToyotaVehicle = z.infer<typeof ToyotaVehicle>;

export const ToyotaContract = z.object({
  account_id: str,
  customer_id: str,
  vehicle_id: str,
  contract_type: z.preprocess((v) => String(v ?? "").trim().toLowerCase(), z.enum(["loan", "lease"])),
  contract_start: str,
  term_months: numReq,
  months_elapsed: numReq,
  months_remaining: numReq,
  contract_end: str,
  missed_payments_12m: numReq,
  autopay: yn,
  amount_financed: centsReq,
  apr: num,
  money_factor: num,
  monthly_payment: centsReq,
  current_balance: cents,
  payoff_quote: cents,
  residual_value: cents,
  mileage_allowance_total: num,
  est_equity: centsReq,
  payment_due_day: numReq,
});
export type ToyotaContract = z.infer<typeof ToyotaContract>;

export const Situation = z.object({
  situation_id: str,
  customer_id: str,
  customer_says: str,
  context_summary: str,
});
export type Situation = z.infer<typeof Situation>;

export const OptionScenario = z.object({
  customer_id: str,
  option_id: str,
  option_name: str,
  new_monthly_payment: cents,
  monthly_payment_change: cents,
  upfront_cost: cents,
  total_cost_vs_keep_as_is: cents,
  eligibility: str,
  plain_language_summary: str,
  key_assumption: str,
  tradeoff: str,
});
export type OptionScenario = z.infer<typeof OptionScenario>;

export const Offer = z.object({
  offer_id: str,
  offer_name: str,
  next_step_type: str,
  eligibility_rule_summary: str,
  business_value: str,
  service_effort: str,
});
export type Offer = z.infer<typeof Offer>;

export const RateRow = z.object({
  credit_tier: str,
  tier_label: str,
  term_months: numReq,
  new_purchase_apr: numReq,
  refinance_apr: numReq,
});
export type RateRow = z.infer<typeof RateRow>;

export const ValueDriver = z.object({
  driver_id: str,
  description: str,
  assumption_text: str,
  value_usd: centsReq,
  value_type: str,
});
export type ValueDriver = z.infer<typeof ValueDriver>;

export const GoldenAnswer = z.object({
  customer_id: str,
  best_next_move: str,
  next_step_type: str,
  offer_id: str,
  plain_language_message: str,
  why_not_the_others: str,
  guardrail_notes: str,
  value_driver_ids: str,
  value_if_completed_usd: cents,
  assumed_take_rate: num,
  expected_value_usd: cents,
});
export type GoldenAnswer = z.infer<typeof GoldenAnswer>;

export interface ToyotaData {
  customers: ToyotaCustomer[];
  vehicles: ToyotaVehicle[];
  accounts: ToyotaContract[];
  situations: Situation[];
  options: OptionScenario[];
  offers: Offer[];
  rates: RateRow[];
  valueDrivers: ValueDriver[];
  golden: GoldenAnswer[];
}
