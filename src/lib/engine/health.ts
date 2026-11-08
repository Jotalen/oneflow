import { debtPayments, discretionaryMonthly, essentialMonthly, liquidTotal, recurringBills, takeHome } from "./cashflow";
import type { Profile } from "./types";

/** 8 indicators mirroring PNC wellness metrics (docs/pnc-parity.md). All finite for any profile. */
export interface HealthReport {
  runwayMonths: number;
  dtiPct: number;
  utilizationPct: number;
  savingsRatePct: number;
  shockResilient: boolean;
  carEquityRatio: number | null;
  ptiPct: number;
  subscriptionBurdenPct: number;
}

export const SHOCK_THRESHOLD = 150_000; // $1,500 surprise
const RUNWAY_CAP = 99;

const pct = (num: number, den: number): number => (den > 0 ? round1((num / den) * 100) : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;

export function health(p: Profile): HealthReport {
  const liquid = liquidTotal(p);
  const income = p.incomeMonthly ?? 0;
  const essential = essentialMonthly(p);
  const runway = essential > 0 ? liquid / essential : liquid > 0 ? RUNWAY_CAP : 0;
  const cards = p.accounts.filter((a) => a.kind === "card");
  const cardBal = cards.reduce((s, a) => s + Math.max(0, a.balance), 0);
  const cardLim = cards.reduce((s, a) => s + (a.creditLimit ?? 0), 0);
  const debtBills = p.bills.filter((b) => b.status === "recurring" && b.isDebtPayment).reduce((s, b) => s + b.amount, 0);
  const net = takeHome(p);
  const outflow = recurringBills(p) + debtPayments(p) + discretionaryMonthly(p);
  const subs = p.bills.filter((b) => b.status === "recurring" && b.isSubscription).reduce((s, b) => s + b.amount, 0);

  return {
    runwayMonths: round1(Math.min(RUNWAY_CAP, Math.max(0, runway))),
    dtiPct: pct(debtPayments(p) + debtBills, income),
    utilizationPct: pct(cardBal, cardLim),
    savingsRatePct: net > 0 ? round1(((net - outflow) / net) * 100) : 0,
    shockResilient: liquid >= SHOCK_THRESHOLD,
    carEquityRatio: p.contract && p.car && p.car.marketValue > 0 ? Math.round((p.contract.estEquity / p.car.marketValue) * 10_000) / 10_000 : null,
    ptiPct: p.contract ? pct(p.contract.monthlyPayment, income) : 0,
    subscriptionBurdenPct: income > 0 ? Math.round((subs / income) * 100 * 1000) / 1000 : 0,
  };
}
