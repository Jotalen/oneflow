/**
 * Pure helpers for the Everyday pages (day-to-day, transactions, budget, rewards).
 * Deterministic, no I/O: localStorage reads/writes live in the components.
 */
import { CATEGORY_LABEL, REWARD_RATE, type Budget, type BudgetCategory, type Category, type LedgerTxn } from "@/lib/bank/view";
import { fmtUSD, parseCents, type Cents } from "@/lib/money";

export type AmountFilter = "any" | "under25" | "25to100" | "over100";
const SMALL: Cents = 2_500;
const LARGE: Cents = 10_000;

export const AMOUNT_FILTERS: { value: AmountFilter; label: string }[] = [
  { value: "any", label: "Any amount" },
  { value: "under25", label: "Under $25" },
  { value: "25to100", label: "$25 – $100" },
  { value: "over100", label: "Over $100" },
];

const inBucket = (amount: Cents, f: AmountFilter): boolean => {
  const a = Math.abs(amount);
  if (f === "under25") return a < SMALL;
  if (f === "25to100") return a >= SMALL && a <= LARGE;
  if (f === "over100") return a > LARGE;
  return true;
};

export interface TxnMeta { category?: Category; note?: string }
export type TxnMetaMap = Record<string, TxnMeta>;

export const categoryOf = (t: LedgerTxn, meta: TxnMetaMap = {}): Category => meta[t.id]?.category ?? t.category;

export interface LedgerFilter { q?: string; accountId?: string; category?: Category; amount?: AmountFilter }

/** Search merchant / category / account / amount text plus dropdown filters. */
export function filterLedger(ledger: LedgerTxn[], f: LedgerFilter, meta: TxnMetaMap = {}): LedgerTxn[] {
  const q = (f.q ?? "").trim().toLowerCase();
  return ledger.filter((t) => {
    const cat = categoryOf(t, meta);
    if (f.accountId && t.accountId !== f.accountId) return false;
    if (f.category && cat !== f.category) return false;
    if (f.amount && !inBucket(t.amount, f.amount)) return false;
    if (!q) return true;
    const hay = [t.merchant, CATEGORY_LABEL[cat], t.accountLabel, (Math.abs(t.amount) / 100).toFixed(2), meta[t.id]?.note ?? ""].join(" ").toLowerCase();
    return hay.includes(q);
  });
}

export interface DayGroup { date: string; txns: LedgerTxn[] }

/** Group a date-sorted ledger into consecutive day buckets. */
export function groupByDay(ledger: LedgerTxn[]): DayGroup[] {
  return ledger.reduce<DayGroup[]>((groups, t) => {
    const last = groups[groups.length - 1];
    if (last && last.date === t.date) return [...groups.slice(0, -1), { date: last.date, txns: [...last.txns, t] }];
    return [...groups, { date: t.date, txns: [t] }];
  }, []);
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function ledgerCsv(ledger: LedgerTxn[], meta: TxnMetaMap = {}): string {
  const header = "date,merchant,account,category,amount,note";
  const rows = ledger.map((t) => [t.date, t.merchant, t.accountLabel, CATEGORY_LABEL[categoryOf(t, meta)], (t.amount / 100).toFixed(2), meta[t.id]?.note ?? ""].map(csvCell).join(","));
  return [header, ...rows].join("\n");
}

export type BudgetOverrides = Record<string, Cents>;

const noteFor = (c: BudgetCategory): string => {
  if (c.fixed) return c.spent >= c.limit ? "Paid" : "Due this month";
  return c.spent > c.limit ? `Over by ${fmtUSD(c.spent - c.limit)}` : `${fmtUSD(c.limit - c.spent)} left`;
};

/** Apply user-edited limits (valid non-negative cents only); returns a new Budget with totals recomputed. */
export function applyBudgetOverrides(budget: Budget, overrides: BudgetOverrides): Budget {
  const categories = budget.categories.map((c) => {
    const o = overrides[c.key];
    const limit = typeof o === "number" && Number.isFinite(o) && o >= 0 ? Math.round(o) : c.limit;
    const next = { ...c, limit };
    return { ...next, note: noteFor(next) };
  });
  return {
    ...budget,
    categories,
    spent: categories.reduce((s, c) => s + c.spent, 0),
    limit: categories.reduce((s, c) => s + c.limit, 0),
  };
}

const NOT_SPENDING: Category[] = ["income", "transfer"];

/** Spending per calendar month for months present in the ledger, oldest first. */
export function monthlySpend(ledger: LedgerTxn[]): { month: string; spent: Cents }[] {
  const totals = ledger
    .filter((t) => t.amount < 0 && !NOT_SPENDING.includes(t.category))
    .reduce<Record<string, Cents>>((acc, t) => {
      const m = t.date.slice(0, 7);
      return { ...acc, [m]: (acc[m] ?? 0) - t.amount };
    }, {});
  return Object.keys(totals).sort().map((month) => ({ month, spent: totals[month] }));
}

/** Points a ledger row earns (card purchases only), same rule as rewardsFor. */
export function pointsForTxn(t: LedgerTxn): number {
  if (t.accountKind !== "card" || t.kind !== "purchase" || t.amount >= 0) return 0;
  return Math.round((Math.abs(t.amount) / 100) * (REWARD_RATE[t.category] ?? 1));
}

export interface Redemption { id: string; points: number; at: string; label: string }

export function availablePoints(earned: number, redemptions: Redemption[]): number {
  return Math.max(0, earned - redemptions.reduce((s, r) => s + r.points, 0));
}

/** "$12.50" → 1250; null for empty, non-numeric, zero or negative. */
export function parseDollarInput(raw: string): Cents | null {
  const c = parseCents(raw);
  return c !== null && c > 0 ? c : null;
}
