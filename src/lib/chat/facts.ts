import type { Analysis } from "@/lib/engine/analyze";
import { guardrails } from "@/lib/engine/guardrails";
import type { BankView } from "@/lib/bank/view";
import { pendingCents } from "@/lib/bank/pending";
import { fmtUSD, type Cents } from "@/lib/money";
import type { RateRow } from "@/lib/toyota/types";
import { carAffordability, moneyInputs, paymentPlan, paySnapshot, solanaAutoBuy, type CarOffer } from "./money";
import { modelsIn, OFFERS_END, OFFERS_SOURCE, toyotaDeals } from "./toyotaOffers";
import type { Topic } from "./suggestions";

/** Everything Ask AI can see about one customer. Built on the server from the live profile. */
export interface ChatCtx { analysis: Analysis; view: BankView; rates: RateRow[]; today: string }

/** A Solana auto-buy the customer can confirm in the app (the model never sets it up by itself). */
export interface AutoBuyProposal { percent: number; perPaycheck: string; perPaycheckCents: number; monthly: string; nextPayday: string }

const RECENT_TXNS = 25;
const PLAN_DAYS = 31;
const SHOWN_DEALS = 5;
const DEFAULT_PCT = 5;
const MIN_PCT = 1;
const MAX_PCT = 25;
const usd = (c: Cents) => fmtUSD(c);
const signed = (c: Cents) => `${c >= 0 ? "+" : "−"}${fmtUSD(Math.abs(c))}`;

/** The customer's whole account, every number formatted, so the model only ever quotes. */
export function accountSnapshot(ctx: ChatCtx) {
  const { analysis: a, view: v } = ctx;
  const p = a.profile;
  const s = paySnapshot(moneyInputs(p, v, ctx.today));
  return {
    today: ctx.today,
    customer: { name: p.name, age: p.age, creditTier: p.creditTier },
    income: { monthly: usd(p.incomeMonthly), perPaycheck: usd(s.paycheck), paydaysOfMonth: s.paydays, nextPayday: s.nextPayday, last8WeeksIn: usd(v.inOut.inflow), last8WeeksOut: usd(v.inOut.outflow) },
    accounts: p.accounts.map((x) => ({ name: x.nickname, type: x.kind, balance: usd(x.balance), available: usd(x.available), pending: usd(pendingCents(x)), creditLimit: x.creditLimit ? usd(x.creditLimit) : undefined })),
    totals: { cash: usd(v.cash), netWorth: usd(v.netWorth.value), own: usd(v.netWorth.own), owe: usd(v.netWorth.owe), totalDebt: usd(v.totalDebt) },
    rewards: { points: v.rewards.points, worth: usd(v.rewards.valueCents), earnedThisMonth: v.rewards.monthPoints, rates: "3x dining, 2x groceries and gas, 1x everything else; 100 points = $1" },
    credit: { scoreEstimate: v.credit.score, rating: v.credit.label, cardUtilizationPct: v.credit.utilizationPct, onTimePaymentsPct: v.credit.onTimePct, openAccounts: v.credit.accounts },
    car: p.car ? { vehicle: `${p.car.year} ${p.car.model} ${p.car.trim}`, marketValue: usd(p.car.marketValue), odometerMiles: p.car.odometer, milesPerYear: p.car.annualMilesEst, toyotaCareEnds: p.car.toyotaCareEnds, warrantyEnds: p.car.warrantyEnds, nextServiceDue: p.car.nextServiceDue, openRecall: p.car.openRecall } : null,
    carFinancing: p.contract ? { type: p.contract.type, lender: "Toyota Financial Services", payment: usd(p.contract.monthlyPayment), dueDayOfMonth: p.contract.dueDay, paymentsLeft: p.contract.monthsRemaining, termMonths: p.contract.termMonths, aprPct: p.contract.aprPct ?? null, balance: usd(p.contract.balance), payoffToday: usd(p.contract.payoffQuote), equity: usd(p.contract.estEquity), missedPayments12m: p.contract.missedPayments12m, interestPaid: v.loan ? usd(v.loan.interestPaid) : undefined, interestAhead: v.loan ? usd(v.loan.interestAhead) : undefined } : null,
    debts: p.debts.map((d) => ({ name: d.label, type: d.kind, balance: usd(d.balance), aprPct: d.aprPct, monthlyPayment: usd(d.monthlyPayment) })),
    upcomingBills: v.upcoming.map((u) => ({ name: u.label, amount: usd(u.amount), due: u.date, detail: u.detail })),
    budgetThisMonth: { planned: usd(v.budget.limit), spent: usd(v.budget.spent), leftoverAfterPlan: usd(s.monthlyLeftover), categories: v.budget.categories.map((c) => ({ name: c.label, spent: usd(c.spent), limit: usd(c.limit), status: c.note })) },
    safetyNet: { months: v.safetyNet.months, goalMonths: v.safetyNet.goalMonths, essentialsPerMonth: usd(v.safetyNet.essentialsMonthly) },
    recentTransactions: v.ledger.slice(0, RECENT_TXNS).map((t) => ({ date: t.date, merchant: t.merchant, amount: signed(t.amount), account: t.accountLabel, category: t.category, status: t.status })),
    nextBestMoves: a.ranked.slice(0, 3).map((m) => ({ title: m.title, impactBy24Months: usd(m.impact24), why: m.why })),
    needsSpecialist: guardrails(p).humanHandoff,
  };
}

function planFacts(ctx: ChatCtx) {
  const r = paymentPlan(moneyInputs(ctx.analysis.profile, ctx.view, ctx.today), PLAN_DAYS);
  return {
    items: r.items.map((i) => ({ date: i.date, what: i.label, amount: signed(i.amount), checkingAfter: usd(i.balanceAfter) })),
    lowestPoint: { date: r.lowest.date, checking: usd(r.lowest.balance) }, comesUpShort: r.shortfall,
  };
}

const dealFacts = (o: CarOffer) => ({
  model: o.deal.model, startingMsrp: usd(o.deal.price), down: usd(o.deal.downPayment), aprPct: o.deal.aprPct, termMonths: o.deal.termMonths,
  rate: o.deal.rateSource === "toyota-offer" ? `Toyota offer, ends ${OFFERS_END}` : "standard TFS rate for your credit tier",
  bonusCash: o.deal.bonusCash ? usd(o.deal.bonusCash) : undefined, monthly: usd(o.monthly), affordable: o.buy.affordable, why: o.buy.reasons,
  lease: o.deal.lease && o.lease ? { trim: o.deal.lease.trim, monthly: usd(o.deal.lease.monthly), months: o.deal.lease.termMonths, dueAtSigning: usd(o.deal.lease.dueAtSigning), affordable: o.lease.affordable, why: o.lease.reasons } : undefined,
});

function carFacts(ctx: ChatCtx, question: string) {
  const aprFor = (tier: string, term: number) => ctx.rates.find((r) => r.credit_tier === tier && r.term_months === term)?.new_purchase_apr ?? 9.9;
  const offers = carAffordability(moneyInputs(ctx.analysis.profile, ctx.view, ctx.today), toyotaDeals(ctx.analysis.profile.creditTier, aprFor));
  const asked = modelsIn(question).map((m) => m.name);
  const named = offers.filter((o) => asked.includes(o.deal.model));
  const others = offers.filter((o) => !asked.includes(o.deal.model)).sort((x, y) => x.monthly - y.monthly);
  const fits = others.filter((o) => o.buy.affordable);
  // Nothing fits yet: show the closest (cheapest) options with the reasons, not an empty list.
  const shown = (fits.length ? fits : others).slice(0, named.length ? 3 : SHOWN_DEALS);
  return { source: OFFERS_SOURCE, downPaymentRule: "10% down, rounded", askedAbout: named.map(dealFacts), [fits.length ? "otherGoodFits" : "closestOptions"]: shown.map(dealFacts) };
}

const pctIn = (q: string) => {
  const n = Number(q.match(/(\d{1,2}(?:\.\d)?)\s*%/)?.[1] ?? DEFAULT_PCT);
  return Math.min(MAX_PCT, Math.max(MIN_PCT, n));
};

function solanaFacts(ctx: ChatCtx, question: string): { facts: unknown; proposal?: AutoBuyProposal } {
  const m = moneyInputs(ctx.analysis.profile, ctx.view, ctx.today);
  const r = solanaAutoBuy(m, pctIn(question));
  const facts = { percent: r.percent, perPaycheck: usd(r.perPaycheck), monthly: usd(r.monthly), yearly: usd(r.yearly), leftoverAfter: usd(r.leftoverAfter), safetyNetMonths: r.safetyNetMonths, verdict: r.verdict, reasons: r.reasons, howItWorks: "Each payday OneFlow lines up the buy and you approve the USDC to SOL swap in your Phantom wallet." };
  if (r.verdict === "no") return { facts };
  return { facts, proposal: { percent: r.percent, perPaycheck: usd(r.perPaycheck), perPaycheckCents: r.perPaycheck, monthly: usd(r.monthly), nextPayday: paySnapshot(m).nextPayday } };
}

const TOPIC_RE: [Topic, RegExp][] = [
  ["car", /toyota|\bcar\b|lease|dealer|truck|suv|new car|afford a/i],
  ["plan", /paycheck|bill|plan|due|budget/i],
  ["solana", /solana|\bsol\b|crypto|usdc/i],
  ["safety", /safety net|emergency|runway/i],
];

/** Topics a question touches; one question can touch several ("can I afford a RAV4 and still invest 5%?"). */
export function topicsOf(question: string): Topic[] {
  const hit = TOPIC_RE.filter(([t, re]) => re.test(question) || (t === "car" && modelsIn(question).length > 0)).map(([t]) => t);
  return hit.length ? hit : ["other"];
}

export interface ChatFacts { account: unknown; topics: Topic[]; extra: Record<string, unknown>; proposal?: AutoBuyProposal }

/** All facts for one question: the whole account plus the calculations the question needs. */
export function factsFor(ctx: ChatCtx, question: string): ChatFacts {
  const topics = topicsOf(question);
  const needsSpecialist = guardrails(ctx.analysis.profile).humanHandoff;
  const sol = topics.includes("solana") && !needsSpecialist ? solanaFacts(ctx, question) : undefined;
  const extra: Record<string, unknown> = {
    ...(topics.includes("plan") ? { paymentPlan: planFacts(ctx) } : {}),
    ...(topics.includes("car") && !needsSpecialist ? { toyota: carFacts(ctx, question) } : {}),
    ...(sol ? { solanaAutoBuy: sol.facts } : {}),
  };
  return { account: accountSnapshot(ctx), topics, extra, proposal: sol?.proposal };
}
