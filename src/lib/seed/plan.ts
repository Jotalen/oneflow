import type { Cents } from "@/lib/money";
import type { NessieBundle } from "@/lib/engine/types";
import type { ToyotaContract, ToyotaCustomer, ToyotaVehicle } from "@/lib/toyota/types";

/**
 * The intended bank state for one persona, derived deterministically from the Toyota row (ADR-004, Assumption 8).
 * scripts/seed.ts executes it against Nessie; syntheticBundle() renders it locally for demo/offline mode.
 */
export const PAYCHECKS = 8;
export const PURCHASES = 40;
export const NET_RATIO = 0.75;
export const SAVINGS_TARGET_RATIO = 0.15;
export const MIN_DISCRETIONARY_RATIO = 0.2;
export const CD_PERSONAS = new Set(["C005", "C020"]);
export const CD_BALANCE: Cents = 1_000_000;
export const TIER_SCORE: Record<string, number> = { A: 740, B: 690, C: 630, D: 580 };
export const TIER_SAVINGS_MULT: Record<string, number> = { A: 3, B: 1.5, C: 0.5, D: 0.2 };
export const TIER_CARD_LIMIT: Record<string, Cents> = { A: 800_000, B: 500_000, C: 250_000, D: 100_000 };
const SURNAMES = ["Rivera", "Nguyen", "Patel", "Okafor", "Kim", "Garcia", "Hernandez", "Smith", "Johnson", "Lee", "Brown", "Davis", "Martinez", "Lopez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson"];
const ZIP: Record<string, string> = { Richardson: "75080", Plano: "75024", Dallas: "75201", Frisco: "75034", Irving: "75039", Arlington: "76010", "Fort Worth": "76102", Garland: "75040", McKinney: "75070", Denton: "76201", Carrollton: "75006", Allen: "75013", Mesquite: "75149", Lewisville: "75057" };

export interface MerchantDef { cat: string; name: string; weight: number; onCard: boolean }
export const MERCHANTS: MerchantDef[] = [
  { cat: "groceries", name: "Tom Thumb", weight: 0.3, onCard: false },
  { cat: "fuel", name: "QuikTrip", weight: 0.12, onCard: true },
  { cat: "dining", name: "Torchy's Tacos", weight: 0.18, onCard: true },
  { cat: "pharmacy", name: "CVS Pharmacy", weight: 0.05, onCard: false },
  { cat: "rideshare", name: "Uber", weight: 0.05, onCard: true },
  { cat: "retail", name: "Target", weight: 0.12, onCard: true },
  { cat: "coffee", name: "Starbucks", weight: 0.05, onCard: true },
  { cat: "entertainment", name: "AMC Theatres", weight: 0.03, onCard: true },
  { cat: "home", name: "Home Depot", weight: 0.05, onCard: false },
  { cat: "misc", name: "Amazon", weight: 0.05, onCard: true },
];
export const SUBSCRIPTIONS = [
  { payee: "T-Mobile", cents: 8_500, day: 20, minEngagement: 0 },
  { payee: "Netflix", cents: 1_599, day: 3, minEngagement: 1 },
  { payee: "Spotify", cents: 1_199, day: 9, minEngagement: 2 },
  { payee: "Planet Fitness", cents: 3_999, day: 12, minEngagement: 2 },
];
const ENGAGEMENT: Record<string, number> = { Low: 0, Medium: 1, High: 2 };
const CARD_PURCHASE_SHARE = 0.4;
const MIN_PURCHASE: Cents = 300;

export interface BankPlan {
  personaId: string;
  customer: { firstName: string; lastName: string; address: { street_number: string; street_name: string; city: string; state: string; zip: string } };
  accounts: { kind: "checking" | "savings" | "cd" | "card"; nickname: string; balance: Cents; creditLimit?: Cents }[];
  deposits: { count: number; amount: Cents; description: string };
  purchases: { category: string; merchantName: string; amount: Cents; onCard: boolean }[];
  bills: { payee: string; amount: Cents; day: number; nickname: string }[];
  loan: { type: string; status: string; creditScore: number; monthlyPayment: Cents; amount: Cents; description: string };
  netMonthly: Cents;
  discretionaryMonthly: Cents;
}

function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function planBank(cust: ToyotaCustomer, contract: ToyotaContract, vehicle: ToyotaVehicle, idx: number): BankPlan {
  const rand = prng(idx + 1);
  const tier = cust.credit_tier_now;
  const grossMonthly = Math.round(cust.annual_income / 12);
  const netMonthly = Math.round(grossMonthly * NET_RATIO);
  const fixed = contract.monthly_payment + cust.other_monthly_debt;
  const discretionaryMonthly = Math.max(Math.round(netMonthly * MIN_DISCRETIONARY_RATIO), netMonthly - fixed - Math.round(netMonthly * SAVINGS_TARGET_RATIO));
  const limit = TIER_CARD_LIMIT[tier] ?? 250_000;
  const util = 0.2 + 0.4 * (cust.financial_stress_score / 100);

  const accounts: BankPlan["accounts"] = [
    { kind: "checking", nickname: "Everyday Checking", balance: Math.round(netMonthly * 0.6) },
    { kind: "savings", nickname: "Rainy Day Savings", balance: Math.round(fixed * (TIER_SAVINGS_MULT[tier] ?? 0.5)) },
    { kind: "card", nickname: "Rewards Card", balance: Math.round(limit * util), creditLimit: limit },
  ];
  if (CD_PERSONAS.has(cust.customer_id)) accounts.push({ kind: "cd", nickname: "CD 12mo", balance: CD_BALANCE });

  const twoMonths = discretionaryMonthly * 2;
  const purchases: BankPlan["purchases"] = [];
  for (let i = 0; i < PURCHASES; i++) {
    const r = rand();
    let acc = 0;
    const m = MERCHANTS.find((x) => (acc += x.weight) >= r) ?? MERCHANTS[MERCHANTS.length - 1];
    const amount = Math.max(MIN_PURCHASE, Math.round((twoMonths / PURCHASES) * (0.5 + rand())));
    purchases.push({ category: m.cat, merchantName: m.name, amount, onCard: m.onCard && rand() < CARD_PURCHASE_SHARE });
  }

  const bills: BankPlan["bills"] = [];
  if (cust.other_monthly_debt > 0) bills.push({ payee: "Other Lender", amount: cust.other_monthly_debt, day: 1, nickname: "Other debt" });
  if (cust.autopay === "Y") bills.push({ payee: "Toyota Financial Services", amount: contract.monthly_payment, day: contract.payment_due_day, nickname: `TFS ${vehicle.model} autopay` });
  const eng = ENGAGEMENT[cust.digital_engagement] ?? 1;
  for (const s of SUBSCRIPTIONS) if (eng >= s.minEngagement) bills.push({ payee: s.payee, amount: s.cents, day: s.day, nickname: s.payee });

  return {
    personaId: cust.customer_id,
    customer: {
      firstName: cust.first_name,
      lastName: SURNAMES[idx % SURNAMES.length],
      address: { street_number: String(100 + idx), street_name: "Oak Lane", city: cust.city, state: cust.state, zip: ZIP[cust.city] ?? "75001" },
    },
    accounts,
    deposits: { count: PAYCHECKS, amount: Math.round(cust.annual_income / 26), description: `Paycheck (${cust.occupation.split("(")[0].trim()})` },
    purchases,
    bills,
    loan: {
      type: contract.contract_type,
      status: "active",
      creditScore: TIER_SCORE[tier] ?? 650,
      monthlyPayment: contract.monthly_payment,
      amount: contract.current_balance ?? contract.payoff_quote ?? contract.amount_financed,
      description: `TFS ${vehicle.model} ${contract.contract_type}`,
    },
    netMonthly,
    discretionaryMonthly,
  };
}

/** Render a plan as if Nessie had returned it. Ids are stable per persona. */
export function syntheticBundle(plan: BankPlan, personaId: string): NessieBundle {
  const id = (k: string) => `${personaId}-${k}`;
  const typeOf = { checking: "Checking", savings: "Savings", cd: "Savings", card: "Credit Card" } as const;
  const accounts = plan.accounts.map((a) => ({
    id: id(a.kind),
    type: typeOf[a.kind],
    nickname: a.nickname,
    balance_cents: a.balance,
    available_cents: a.kind === "card" ? (a.creditLimit ?? 0) - a.balance : a.balance,
    credit_limit_cents: a.creditLimit,
    customer_id: id("cust"),
  }));
  const txns: NessieBundle["transactionsByAccount"] = { [id("checking")]: [], [id("card")]: [] };
  for (let i = 0; i < plan.deposits.count; i++) {
    txns[id("checking")].push({ id: id(`dep${i}`), kind: "deposit", status: "completed", medium: "balance", amount_cents: plan.deposits.amount, description: plan.deposits.description });
  }
  plan.purchases.forEach((p, i) => {
    const acct = p.onCard ? id("card") : id("checking");
    txns[acct].push({ id: id(`pur${i}`), kind: "purchase", status: "completed", medium: "balance", amount_cents: p.amount, description: p.merchantName, merchant_id: id(`m-${p.category}`) });
  });
  return {
    customer: { id: id("cust"), first_name: plan.customer.firstName, last_name: plan.customer.lastName },
    accounts,
    transactionsByAccount: txns,
    bills: plan.bills.map((b, i) => ({ id: id(`bill${i}`), status: "recurring", payee: b.payee, payment_amount: b.amount / 100, recurring_date: b.day, nickname: b.nickname })),
    loans: [{ id: id("loan"), type: plan.loan.type, status: plan.loan.status, monthly_payment_cents: plan.loan.monthlyPayment, amount_cents: plan.loan.amount, description: plan.loan.description }],
  };
}
