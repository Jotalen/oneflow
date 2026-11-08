import type { Cents } from "@/lib/money";

/** One row of the `account_balance_15m` continuous aggregate. */
export interface BalanceBucket { bucket: string; accountId: string; balanceCents: Cents }
export interface BalancePoint { t: string; cash: Cents; cardOwed: Cents }

/**
 * Turn per-account bucket rows into one series for the chart: total cash (checking, savings, CDs)
 * and card balance owed. An account with no change in a bucket keeps its last known balance.
 */
export function buildBalanceSeries(rows: BalanceBucket[], accounts: { id: string; kind: string }[]): BalancePoint[] {
  const kindOf = new Map(accounts.map((a) => [a.id, a.kind]));
  const latest = new Map<string, Cents>();
  const buckets = [...new Set(rows.filter((r) => kindOf.has(r.accountId)).map((r) => r.bucket))].sort();
  return buckets.map((t) => {
    for (const r of rows) if (r.bucket === t && kindOf.has(r.accountId)) latest.set(r.accountId, r.balanceCents);
    let cash = 0;
    let cardOwed = 0;
    for (const [id, bal] of latest) {
      if (kindOf.get(id) === "card") cardOwed += bal;
      else cash += bal;
    }
    return { t, cash, cardOwed };
  });
}
