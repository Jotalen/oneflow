/**
 * NovaBank view model: every number the wireframe screens show, derived deterministically
 * from the engine Analysis (ADR-003: code computes). No I/O, no randomness.
 *
 * Honesty notes (README): Nessie stamps seeded transactions with the seed time, so posting
 * dates are spread across the 8-week seed window here; the credit score is an estimate from
 * Toyota credit tier, card use and missed payments, not a bureau score.
 */
import { AS_OF, type Contract, type Profile, type Txn } from "@/lib/engine/types";
import type { Analysis } from "@/lib/engine/analyze";
import { fmtUSD, type Cents } from "@/lib/money";

export type Category =
  | "income" | "transfer" | "groceries" | "dining" | "gas" | "shopping" | "subscriptions"
  | "health" | "transport" | "fun" | "home" | "car" | "debt";

export const CATEGORY_LABEL: Record<Category, string> = {
  income: "Income", transfer: "Transfer", groceries: "Groceries", dining: "Dining out", gas: "Gas",
  shopping: "Shopping", subscriptions: "Subscriptions", health: "Health", transport: "Rides",
  fun: "Fun", home: "Home", car: "Car payment", debt: "Other debt",
};

const MERCHANT_CATEGORY: Record<string, Category> = {
  "tom thumb": "groceries", "quiktrip": "gas", "torchy's tacos": "dining", "starbucks": "dining",
  "cvs pharmacy": "health", "uber": "transport", "target": "shopping", "amazon": "shopping",
  "amc theatres": "fun", "home depot": "home",
};

export const WINDOW_DAYS = 56;
const MS_DAY = 86_400_000;

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => isoDay(new Date(Date.parse(`${iso}T00:00:00Z`) + n * MS_DAY));
export const addMonths = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return isoDay(d);
};

export function categorize(kind: string, description = ""): Category {
  const d = description.toLowerCase();
  if (kind === "deposit") return "income";
  if (kind === "transfer" || kind === "withdrawal") return "transfer";
  return MERCHANT_CATEGORY[d] ?? "shopping";
}

export interface LedgerTxn {
  id: string;
  accountId: string;
  accountKind: "checking" | "savings" | "cd" | "card" | "other";
  accountLabel: string;
  date: string;
  merchant: string;
  category: Category;
  /** Signed: negative = money out of the account. */
  amount: Cents;
  status: string;
  kind: string;
}

/** Dated, categorized, signed transactions, newest first. */
export function buildLedger(p: Profile): LedgerTxn[] {
  const accounts = new Map(p.accounts.map((a) => [a.id, a]));
  const ordered = [...p.recentTxns].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || b.id.localeCompare(a.id));
  const n = ordered.length;
  return ordered.map((t: Txn, i) => {
    const acct = accounts.get(t.accountId);
    const category = categorize(t.kind, t.description);
    const sign = t.kind === "deposit" ? 1 : -1;
    const dayOffset = n <= 1 ? 0 : Math.floor((i * (WINDOW_DAYS - 1)) / (n - 1));
    return {
      id: t.id,
      accountId: t.accountId,
      accountKind: acct?.kind ?? "other",
      accountLabel: acct?.nickname ?? "Account",
      date: addDays(AS_OF, -dayOffset),
      merchant: t.description || (category === "income" ? "Deposit" : "Purchase"),
      category,
      amount: sign * Math.abs(t.amount),
      status: t.status,
      kind: t.kind,
    };
  });
}

const isCash = (k: string) => k === "checking" || k === "savings" || k === "cd";

export interface Point { date: string; value: Cents }

/** Daily cash (checking + savings) for the last `days`, walked back from today's balances. */
export function cashHistory(p: Profile, ledger: LedgerTxn[], days: number): Point[] {
  let bal = p.accounts.filter((a) => isCash(a.kind)).reduce((s, a) => s + a.balance, 0);
  const byDay = new Map<string, Cents>();
  for (const t of ledger) if (isCash(t.accountKind)) byDay.set(t.date, (byDay.get(t.date) ?? 0) + t.amount);
  const out: Point[] = [];
  for (let i = 0; i <= days; i++) {
    const date = addDays(AS_OF, -i);
    out.push({ date, value: bal });
    bal -= byDay.get(date) ?? 0;
  }
  return out.reverse();
}

export const REWARD_RATE: Partial<Record<Category, number>> = { dining: 3, groceries: 2, gas: 2 };

export interface Rewards { points: number; valueCents: Cents; monthPoints: number; recent: { txn: LedgerTxn; points: number; rate: number }[] }

/** Card rewards: 3x dining, 2x groceries & gas, 1x everything else. 100 points = $1. */
export function rewardsFor(ledger: LedgerTxn[]): Rewards {
  const earned = ledger
    .filter((t) => t.accountKind === "card" && t.kind === "purchase" && t.amount < 0)
    .map((t) => { const rate = REWARD_RATE[t.category] ?? 1; return { txn: t, rate, points: Math.round((Math.abs(t.amount) / 100) * rate) }; });
  const points = earned.reduce((s, e) => s + e.points, 0);
  const monthPoints = earned.filter((e) => e.txn.date.slice(0, 7) === AS_OF.slice(0, 7)).reduce((s, e) => s + e.points, 0);
  return { points, valueCents: points, monthPoints, recent: earned.slice(0, 6) };
}

const TIER_BASE: Record<string, number> = { A: 765, B: 705, C: 650, D: 600 };
const MISSED_PENALTY = 30;
const UTIL_OK_PCT = 30;
const UTIL_PENALTY_PER_PCT = 0.9;

export interface CreditEstimate { score: number; label: string }

export function creditLabel(score: number): string {
  if (score >= 800) return "Exceptional";
  if (score >= 740) return "Very good";
  if (score >= 670) return "Good";
  if (score >= 580) return "Fair";
  return "Poor";
}

/** Estimated score from what the bank can see. Labeled "estimate" everywhere in the UI. */
export function estimateCreditScore(i: { tier: string; utilizationPct: number; missed12m: number }): CreditEstimate {
  const base = TIER_BASE[i.tier] ?? 650;
  const util = Math.max(0, i.utilizationPct - UTIL_OK_PCT) * UTIL_PENALTY_PER_PCT;
  const lowUseBonus = i.utilizationPct < 10 ? 10 : 0;
  const score = Math.round(Math.min(850, Math.max(300, base - util - i.missed12m * MISSED_PENALTY + lowUseBonus)));
  return { score, label: creditLabel(score) };
}

export interface LoanStats {
  paymentsMade: number;
  paymentsLeft: number;
  totalPaid: Cents;
  principalPaid: Cents;
  interestPaid: Cents;
  interestAhead: Cents;
  amountFinanced: Cents;
  paidOffDate: string;
  nextPaymentDate: string;
  pctPaid: number;
}

/** Simulate paying `balance` at `payment + extra` a month. */
export function payoffWithExtra(balance: Cents, aprPct: number, payment: Cents, extra: Cents): { months: number; interest: Cents } {
  const r = aprPct / 100 / 12;
  let bal = balance;
  let months = 0;
  let interest = 0;
  const pay = payment + extra;
  const MAX_MONTHS = 600;
  while (bal > 0 && months < MAX_MONTHS) {
    const i = Math.round(bal * r);
    if (pay <= i) return { months: Infinity, interest: Infinity };
    interest += i;
    bal = bal + i - pay;
    months++;
  }
  return { months, interest };
}

export function nextDueDate(dueDay: number, from: string = AS_OF): string {
  const [y, m, d] = from.split("-").map(Number);
  const day = Math.min(dueDay, 28);
  const thisMonth = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return d <= day ? thisMonth : addMonths(thisMonth, 1);
}

/** Loan math for the car/house pages. Lease contracts return null (no principal/interest split). */
export function loanStats(c: Contract): LoanStats | null {
  if (c.type !== "loan") return null;
  const apr = c.aprPct ?? 0;
  const totalPaid = c.monthsElapsed * c.monthlyPayment;
  const ahead = payoffWithExtra(c.balance, apr, c.monthlyPayment, 0);
  const totalScheduled = c.monthlyPayment * c.termMonths;
  const amountFinanced = c.amountFinanced ?? c.balance + Math.round(totalPaid * 0.8);
  const principalPaid = Math.min(totalPaid, Math.max(0, amountFinanced - c.balance));
  return {
    paymentsMade: c.monthsElapsed,
    paymentsLeft: c.monthsRemaining,
    totalPaid,
    principalPaid,
    interestPaid: totalPaid - principalPaid,
    interestAhead: Number.isFinite(ahead.interest) ? ahead.interest : Math.max(0, totalScheduled - totalPaid - c.balance),
    amountFinanced,
    paidOffDate: addMonths(nextDueDate(c.dueDay), c.monthsRemaining - 1),
    nextPaymentDate: nextDueDate(c.dueDay),
    pctPaid: c.termMonths ? Math.round((c.monthsElapsed / c.termMonths) * 100) : 0,
  };
}

/** Whole months of saving `monthly` to get from `have` to `target`. */
export function monthsToTarget(have: Cents, target: Cents, monthly: Cents): number {
  if (have >= target) return 0;
  if (monthly <= 0) return Infinity;
  return Math.ceil((target - have) / monthly);
}

export interface BudgetCategory { key: Category | "bills"; label: string; spent: Cents; limit: Cents; note: string; fixed: boolean }
export interface Budget { month: string; dayOfMonth: number; daysInMonth: number; spent: Cents; limit: Cents; categories: BudgetCategory[] }

const FLEX: Category[] = ["groceries", "dining", "gas", "shopping", "health", "transport", "fun", "home"];
const roundUpTo = (c: Cents, step: Cents) => Math.ceil(c / step) * step;
const BUDGET_STEP: Cents = 1_000;
const WEEKS_PER_MONTH = 4.33;

function buildBudget(p: Profile, ledger: LedgerTxn[]): Budget {
  const month = AS_OF.slice(0, 7);
  const dayOfMonth = Number(AS_OF.slice(8, 10));
  const daysInMonth = 30;
  const thisMonth = ledger.filter((t) => t.date.startsWith(month) && t.amount < 0);
  const weeks = WINDOW_DAYS / 7;
  const flex: BudgetCategory[] = FLEX.map((cat) => {
    const all = ledger.filter((t) => t.category === cat && t.amount < 0).reduce((s, t) => s - t.amount, 0);
    const spent = thisMonth.filter((t) => t.category === cat).reduce((s, t) => s - t.amount, 0);
    const limit = roundUpTo((all / weeks) * WEEKS_PER_MONTH, BUDGET_STEP);
    return { key: cat, label: CATEGORY_LABEL[cat], spent, limit, note: "", fixed: false };
  }).filter((c) => c.limit > 0);
  const fixed: BudgetCategory[] = [];
  if (p.contract) {
    const paid = p.contract.dueDay <= dayOfMonth;
    fixed.push({ key: "car", label: p.contract.type === "lease" ? "Car lease" : "Car payment", spent: paid ? p.contract.monthlyPayment : 0, limit: p.contract.monthlyPayment, note: "", fixed: true });
  }
  const subs = p.bills.filter((b) => b.isSubscription && b.status === "recurring");
  if (subs.length) {
    const limit = subs.reduce((s, b) => s + b.amount, 0);
    const spent = subs.filter((b) => (b.dueDay ?? 1) <= dayOfMonth).reduce((s, b) => s + b.amount, 0);
    fixed.push({ key: "subscriptions", label: "Subscriptions & phone", spent, limit, note: "", fixed: true });
  }
  const other = p.bills.filter((b) => b.isDebtPayment && b.status === "recurring");
  if (other.length) {
    const limit = other.reduce((s, b) => s + b.amount, 0);
    const spent = other.filter((b) => (b.dueDay ?? 1) <= dayOfMonth).reduce((s, b) => s + b.amount, 0);
    fixed.push({ key: "debt", label: "Other debt", spent, limit, note: "", fixed: true });
  }
  const categories = [...fixed, ...flex].map((c) => ({
    ...c,
    note: c.fixed ? (c.spent >= c.limit ? "Paid" : "Due this month") : c.spent > c.limit ? `Over by ${fmtUSD(c.spent - c.limit)}` : `${fmtUSD(c.limit - c.spent)} left`,
  }));
  return {
    month, dayOfMonth, daysInMonth,
    spent: categories.reduce((s, c) => s + c.spent, 0),
    limit: categories.reduce((s, c) => s + c.limit, 0),
    categories,
  };
}

export interface NetWorthPart { key: string; label: string; detail: string; value: Cents }
export interface NetWorth { value: Cents; own: Cents; owe: Cents; ownParts: NetWorthPart[]; owePart: NetWorthPart[] }

function buildNetWorth(p: Profile): NetWorth {
  const cash = p.accounts.filter((a) => isCash(a.kind)).reduce((s, a) => s + a.balance, 0);
  const ownParts: NetWorthPart[] = [{ key: "cash", label: "Cash", detail: "Checking and savings", value: cash }];
  if (p.car && p.contract?.type === "loan") ownParts.push({ key: "car", label: "Car", detail: `${p.car.year} ${p.car.model} ${p.car.trim} · market value estimate`, value: p.car.marketValue });
  const owePart: NetWorthPart[] = p.debts
    .filter((d) => d.kind !== "auto_lease" && d.balance > 0)
    .map((d) => ({ key: d.id, label: d.kind === "card" ? d.label : d.kind === "auto_loan" ? "Toyota auto loan" : d.label, detail: `${d.aprPct}% APR`, value: d.balance }));
  const own = ownParts.reduce((s, x) => s + x.value, 0);
  const owe = owePart.reduce((s, x) => s + x.value, 0);
  return { value: own - owe, own, owe, ownParts, owePart };
}

export interface SafetyNet { months: number; fund: Cents; essentialsMonthly: Cents; essentials: { label: string; value: Cents }[]; goalMonths: number; options: { monthly: Cents; months: number; date: string }[] }

const SAFETY_GOAL_MONTHS = 6;
const SAFETY_OPTIONS: Cents[] = [15_000, 30_000, 50_000];

function buildSafetyNet(p: Profile, budget: Budget): SafetyNet {
  const fund = p.accounts.filter((a) => isCash(a.kind)).reduce((s, a) => s + a.balance, 0);
  const lim = (k: string) => budget.categories.find((c) => c.key === k)?.limit ?? 0;
  const essentials = [
    { label: p.contract?.type === "lease" ? "Car lease" : "Car payment", value: lim("car") },
    { label: "Groceries", value: lim("groceries") },
    { label: "Gas", value: lim("gas") },
    { label: "Phone & subscriptions", value: lim("subscriptions") },
    { label: "Other debt payments", value: lim("debt") },
    { label: "Health", value: lim("health") },
  ].filter((e) => e.value > 0);
  const essentialsMonthly = Math.max(1, essentials.reduce((s, e) => s + e.value, 0));
  const target = essentialsMonthly * SAFETY_GOAL_MONTHS;
  return {
    months: Math.round((fund / essentialsMonthly) * 10) / 10,
    fund,
    essentialsMonthly,
    essentials,
    goalMonths: SAFETY_GOAL_MONTHS,
    options: SAFETY_OPTIONS.map((monthly) => { const m = monthsToTarget(fund, target, monthly); return { monthly, months: m, date: Number.isFinite(m) ? addMonths(AS_OF, m) : "" }; }),
  };
}

export interface MoneyInOut { inflow: Cents; outflow: Cents; net: Cents; nextPayday: string; nextPaycheck: Cents }

function buildInOut(p: Profile, ledger: LedgerTxn[]): MoneyInOut {
  const since = addDays(AS_OF, -30);
  const chk = ledger.filter((t) => t.accountKind === "checking" && t.date > since);
  const inflow = chk.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const outflow = chk.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0);
  return { inflow, outflow, net: inflow - outflow, nextPayday: nextDueDate(p.paydayDay, addDays(AS_OF, 1)), nextPaycheck: Math.round(p.incomeMonthly / 2) };
}

export interface UpcomingBill { id: string; label: string; detail: string; amount: Cents; date: string }

function buildUpcoming(p: Profile): UpcomingBill[] {
  const bills: UpcomingBill[] = p.bills
    .filter((b) => b.status === "recurring" && !b.isVehiclePayment)
    .map((b) => ({ id: b.id, label: b.nickname ?? b.payee, detail: "Autopay on", amount: b.amount, date: nextDueDate(b.dueDay ?? 1, addDays(AS_OF, 1)) }));
  if (p.contract) bills.push({ id: "car", label: `Car payment · Toyota`, detail: `Payment ${p.contract.monthsElapsed + 1} of ${p.contract.termMonths}${p.flags.autopay ? " · autopay on" : ""}`, amount: p.contract.monthlyPayment, date: nextDueDate(p.contract.dueDay, addDays(AS_OF, 1)) });
  const card = p.debts.find((d) => d.kind === "card");
  if (card && card.balance > 0) bills.push({ id: "card", label: card.label, detail: `Minimum due · balance ${fmtUSD(card.balance)}`, amount: card.monthlyPayment, date: nextDueDate(21, addDays(AS_OF, 1)) });
  return bills.sort((a, b) => a.date.localeCompare(b.date));
}

export interface BankView {
  ledger: LedgerTxn[];
  cash: Cents;
  checking: Cents;
  cardBalance: Cents;
  cardLimit: Cents;
  cashHistory: Point[];
  netWorth: NetWorth;
  totalDebt: Cents;
  budget: Budget;
  rewards: Rewards;
  credit: CreditEstimate & { utilizationPct: number; onTimePct: number; accounts: number };
  safetyNet: SafetyNet;
  inOut: MoneyInOut;
  upcoming: UpcomingBill[];
  loan: LoanStats | null;
}

export function buildBankView(a: Analysis): BankView {
  const p = a.profile;
  const ledger = buildLedger(p);
  const budget = buildBudget(p, ledger);
  const card = p.accounts.find((x) => x.kind === "card");
  const netWorth = buildNetWorth(p);
  const leaseBalance = p.debts.filter((d) => d.kind === "auto_lease").reduce((s, d) => s + d.balance, 0);
  const missed = p.flags.missed12m;
  const credit = estimateCreditScore({ tier: p.creditTier, utilizationPct: a.health.utilizationPct, missed12m: missed });
  return {
    ledger,
    cash: p.accounts.filter((x) => isCash(x.kind)).reduce((s, x) => s + x.balance, 0),
    checking: p.accounts.filter((x) => x.kind === "checking").reduce((s, x) => s + x.balance, 0),
    cardBalance: card?.balance ?? 0,
    cardLimit: card?.creditLimit ?? 0,
    cashHistory: cashHistory(p, ledger, 30),
    netWorth,
    totalDebt: netWorth.owe + leaseBalance,
    budget,
    rewards: rewardsFor(ledger),
    credit: { ...credit, utilizationPct: a.health.utilizationPct, onTimePct: Math.round(((12 - Math.min(12, missed)) / 12) * 100), accounts: p.accounts.length + (p.contract ? 1 : 0) },
    safetyNet: buildSafetyNet(p, budget),
    inOut: buildInOut(p, ledger),
    upcoming: buildUpcoming(p),
    loan: p.contract ? loanStats(p.contract) : null,
  };
}
