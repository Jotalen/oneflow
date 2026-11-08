import { amortize } from "@/lib/engine/amortize";
import type { Profile } from "@/lib/engine/types";
import { paydaysFor } from "@/lib/bank/balanceEstimate";
import { addDays, nextDueDate, type BankView } from "@/lib/bank/view";
import { fmtUSD, type Cents } from "@/lib/money";

/**
 * Money facts the chat's tools quote. All math happens here, in code; the model only words it.
 * Pay is modelled like the rest of the app: monthly income in two equal paychecks.
 */
export interface MoneyInputs {
  incomeMonthly: Cents;
  paydayDay: number;
  checkingAvailable: Cents;
  cash: Cents;
  /** The monthly budget plan (bills, car, groceries…). */
  plannedMonthly: Cents;
  essentialsMonthly: Cents;
  carPaymentMonthly: Cents;
  creditTier: string;
  highestCardApr: { label: string; aprPct: number } | null;
  upcoming: { label: string; amount: Cents; date: string }[];
  today: string;
}

const PAYCHECKS_PER_MONTH = 2;
const SAFETY_MIN_MONTHS = 3;
const CAR_SHARE_MAX_PCT = 15;
const EXPENSIVE_APR_PCT = 15;
const round1 = (n: number) => Math.round(n * 10) / 10;

export function moneyInputs(p: Profile, v: BankView, today: string): MoneyInputs {
  const checking = p.accounts.find((a) => a.kind === "checking");
  const card = p.debts.filter((d) => d.kind === "card" && d.balance > 0).sort((a, b) => b.aprPct - a.aprPct)[0];
  return {
    incomeMonthly: p.incomeMonthly, paydayDay: p.paydayDay, checkingAvailable: checking?.available ?? v.checking, cash: v.cash,
    plannedMonthly: v.budget.limit, essentialsMonthly: v.safetyNet.essentialsMonthly, carPaymentMonthly: p.contract?.monthlyPayment ?? 0,
    creditTier: p.creditTier, highestCardApr: card ? { label: card.label, aprPct: card.aprPct } : null,
    upcoming: v.upcoming.map((u) => ({ label: u.label, amount: u.amount, date: u.date })), today,
  };
}

export interface PaySnapshot { paycheck: Cents; paydays: number[]; nextPayday: string; monthlyLeftover: Cents; safetyNetMonths: number }

export function paySnapshot(m: MoneyInputs): PaySnapshot {
  const paydays = paydaysFor(m.paydayDay);
  const nextPayday = paydays.map((d) => nextDueDate(d, m.today)).sort()[0];
  return {
    paycheck: Math.round(m.incomeMonthly / PAYCHECKS_PER_MONTH), paydays, nextPayday,
    monthlyLeftover: m.incomeMonthly - m.plannedMonthly, safetyNetMonths: round1(m.cash / Math.max(1, m.essentialsMonthly)),
  };
}

export interface PlanItem { date: string; label: string; amount: Cents; balanceAfter: Cents }
export interface PaymentPlan { items: PlanItem[]; lowest: { date: string; balance: Cents }; shortfall: boolean }

/** Checking balance through the next `days`: paychecks in, upcoming bills out, in date order. */
export function paymentPlan(m: MoneyInputs, days: number): PaymentPlan {
  const end = addDays(m.today, days);
  const { paycheck, paydays } = paySnapshot(m);
  const paydates = paydays.flatMap((d) => [nextDueDate(d, m.today), nextDueDate(d, addDays(nextDueDate(d, m.today), 1))]);
  const events = [
    ...paydates.map((date) => ({ date, label: "Paycheck", amount: paycheck, order: 0 })),
    ...m.upcoming.map((u) => ({ date: u.date, label: u.label, amount: -u.amount, order: 1 })),
  ].filter((e) => e.date >= m.today && e.date <= end).sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
  const items = events.reduce<PlanItem[]>((acc, e) => [...acc, { date: e.date, label: e.label, amount: e.amount, balanceAfter: (acc.at(-1)?.balanceAfter ?? m.checkingAvailable) + e.amount }], []);
  const lowest = items.reduce((lo, i) => (i.balanceAfter < lo.balance ? { date: i.date, balance: i.balanceAfter } : lo), { date: m.today, balance: m.checkingAvailable });
  return { items, lowest, shortfall: lowest.balance < 0 };
}

/** One Toyota deal priced for this customer (see toyotaOffers.ts for where the numbers come from). */
export interface CarDeal {
  id: string;
  model: string;
  price: Cents;
  downPayment: Cents;
  aprPct: number;
  termMonths: number;
  /** "toyota-offer": Toyota's current APR offer; "tfs-standard": the regular TFS rate for their credit tier. */
  rateSource: "toyota-offer" | "tfs-standard";
  bonusCash?: Cents;
  lease?: { trim: string; monthly: Cents; termMonths: number; dueAtSigning: Cents };
}

export interface Fit { affordable: boolean; reasons: string[]; paymentPctOfIncome: number; safetyNetAfter: number }
export interface CarOffer { deal: CarDeal; monthly: Cents; buy: Fit; lease?: Fit }

/** Would `monthly` with `upfront` cash out fit: safety net after paying upfront, share of income, monthly leftover. */
function fits(m: MoneyInputs, monthly: Cents, upfront: Cents, leftover: Cents): Fit {
  const paymentPctOfIncome = (monthly / Math.max(1, m.incomeMonthly)) * 100;
  const safetyNetAfter = round1((m.cash - upfront) / Math.max(1, m.essentialsMonthly));
  const reasons = [
    ...(safetyNetAfter < SAFETY_MIN_MONTHS ? [`Paying ${fmtUSD(upfront)} upfront would leave a ${safetyNetAfter}-month safety net (aim for ${SAFETY_MIN_MONTHS}+).`] : []),
    ...(paymentPctOfIncome > CAR_SHARE_MAX_PCT ? [`${fmtUSD(monthly)}/mo is ${round1(paymentPctOfIncome)}% of income (aim for ${CAR_SHARE_MAX_PCT}% or less).`] : []),
    ...(leftover + m.carPaymentMonthly - monthly < 0 ? [`${fmtUSD(monthly)}/mo is more than what's left each month after your plan.`] : []),
  ];
  return { affordable: reasons.length === 0, reasons, paymentPctOfIncome: round1(paymentPctOfIncome), safetyNetAfter };
}

/** Each deal's monthly payment (amortized in code) and whether buying or leasing it fits this customer. */
export function carAffordability(m: MoneyInputs, deals: CarDeal[]): CarOffer[] {
  const leftover = paySnapshot(m).monthlyLeftover;
  return deals.map((d) => {
    const monthly = amortize(d.price - d.downPayment - (d.bonusCash ?? 0), d.aprPct, d.termMonths);
    return { deal: d, monthly, buy: fits(m, monthly, d.downPayment, leftover), ...(d.lease ? { lease: fits(m, d.lease.monthly, d.lease.dueAtSigning, leftover) } : {}) };
  });
}

export interface AutoBuyCheck { percent: number; perPaycheck: Cents; monthly: Cents; yearly: Cents; leftoverAfter: Cents; safetyNetMonths: number; verdict: "yes" | "caution" | "no"; reasons: string[] }

/** Can `percent` of each paycheck go to Solana (USDC → SOL) without hurting bills, the safety net or debt payoff? */
export function solanaAutoBuy(m: MoneyInputs, percent: number): AutoBuyCheck {
  const s = paySnapshot(m);
  const perPaycheck = Math.round((s.paycheck * percent) / 100);
  const monthly = perPaycheck * PAYCHECKS_PER_MONTH;
  const leftoverAfter = s.monthlyLeftover - monthly;
  const no = [
    ...(leftoverAfter < 0 ? [`${fmtUSD(monthly)}/mo is more than the ${fmtUSD(Math.max(0, s.monthlyLeftover))} left after your monthly plan.`] : []),
    ...(s.safetyNetMonths < 1 ? [`Your safety net covers ${s.safetyNetMonths} months; build that first.`] : []),
  ];
  const caution = [
    ...(s.safetyNetMonths < SAFETY_MIN_MONTHS ? [`Your safety net covers ${s.safetyNetMonths} months (aim for ${SAFETY_MIN_MONTHS}+).`] : []),
    ...(m.highestCardApr && m.highestCardApr.aprPct >= EXPENSIVE_APR_PCT ? [`${m.highestCardApr.label} charges ${m.highestCardApr.aprPct}% APR; paying it down earns more than most investments.`] : []),
  ];
  const verdict = no.length ? "no" : caution.length ? "caution" : "yes";
  return { percent, perPaycheck, monthly, yearly: monthly * 12, leftoverAfter, safetyNetMonths: s.safetyNetMonths, verdict, reasons: [...no, ...caution] };
}
