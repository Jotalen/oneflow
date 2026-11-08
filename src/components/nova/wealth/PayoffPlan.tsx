"use client";
import Link from "next/link";
import { Panel, fmtMonth } from "@/components/nova/ui";
import { useReadyBank } from "@/components/nova/BankProvider";
import { fmtUSD } from "@/lib/money";
import { AS_OF, type Debt } from "@/lib/engine/types";
import { addMonths, payoffWithExtra } from "@/lib/bank/view";
import { compareStrategies, type PayoffDebt, type StrategyResult } from "@/lib/bank/borrowing";
import type { RankedDebt } from "@/lib/bank/wealth";
import { ActionNote } from "./ActionNote";
import { useMoneyMove } from "./useMoneyMove";

const MOVE_ID = "pay_highest_apr";
const FALLBACK_SHARE = 0.1;
const MIN_EXTRA = 2_500;
const STRATEGY_TEXT: Record<StrategyResult["strategy"], { name: string; how: string }> = {
  avalanche: { name: "Avalanche", how: "Extra goes to the highest rate first" },
  snowball: { name: "Snowball", how: "Extra goes to the smallest balance first" },
  minimums: { name: "Minimums only", how: "No extra; each debt at today's minimum" },
};

/** Leases have fixed payments and no APR, so they're not part of a payoff plan. */
const payoffDebts = (debts: Debt[]): PayoffDebt[] =>
  debts.filter((d) => d.kind !== "auto_lease" && d.balance > 0).map((d) => ({ id: d.id, label: d.label, balance: d.balance, aprPct: d.aprPct, minPayment: d.monthlyPayment }));

export function PayoffPlan({ target, debts }: { target: RankedDebt; debts: Debt[] }) {
  const b = useReadyBank();
  const move = useMoneyMove();
  if (!b) return null;
  const { analysis, view, transfer, transferring, accept, accepting, receipts } = b;
  const d = target.debt;
  const ranked = analysis.ranked.find((m) => m.id === MOVE_ID);
  const extraFromMove = ranked ? Number((ranked.overrides as { extraToDebtMonthly?: number }).extraToDebtMonthly ?? 0) : 0;
  const extra = extraFromMove > 0 ? extraFromMove : Math.max(MIN_EXTRA, Math.round(d.balance * FALLBACK_SHARE));
  const monthly = d.monthlyPayment + extra;
  const plan = payoffWithExtra(d.balance, d.aprPct, d.monthlyPayment, extra);
  const strategies = compareStrategies(payoffDebts(debts), extra);
  const isCard = d.kind === "card";
  const canPayFull = isCard && view.checking >= d.balance;
  const receipt = receipts.find((r) => r.moveId === MOVE_ID);
  const fallbackAmount = Math.min(monthly, d.balance, view.checking);

  const payFull = () => move.run(() => transfer("checking", "card", d.balance, `Card payment: ${d.label}`.slice(0, 80)), `Paid ${fmtUSD(d.balance)} to ${d.label}.`);
  const payOnce = () => move.run(() => transfer("checking", "card", fallbackAmount, `Card payment: ${d.label}`.slice(0, 80)), `Paid ${fmtUSD(fallbackAmount)} to ${d.label}.`);

  return (
    <Panel title="Payoff plan" subtitle={`Paying ${fmtUSD(extra)} a month extra, compared with minimums only`}>
      <StrategyList rows={strategies} />
      <div className="grid gap-3 mt-4">
        {canPayFull && (
          <div className="rounded-xl bg-surface-2 p-3">
            <div className="text-xs text-muted">Option A</div>
            <div className="font-semibold">Pay the card in full today</div>
            <p className="text-sm text-muted">{fmtUSD(d.balance)} from checking. You&apos;d still have {fmtUSD(view.checking - d.balance)} there.</p>
          </div>
        )}
        <div className="rounded-xl bg-surface-2 p-3">
          <div className="text-xs text-muted">Option {canPayFull ? "B" : "A"}</div>
          <div className="font-semibold">Pay {fmtUSD(monthly)} a month on {d.label}</div>
          <p className="text-sm text-muted">{isCard ? "Each payment posts to your card in the bank. " : "Toyota loans can't be paid from here yet, so the extra is set aside in savings. "}{Number.isFinite(plan.months) ? `Paid off by ${fmtMonth(addMonths(AS_OF, plan.months))}, about ${fmtUSD(plan.interest)} in interest.` : "That still doesn't cover the interest."}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        {canPayFull && <button className="btn btn-primary" disabled={transferring} onClick={() => void payFull()}>{transferring ? "Paying…" : "Pay card in full"}</button>}
        {ranked ? (
          <button className={`btn ${canPayFull ? "" : "btn-primary"}`} disabled={accepting === MOVE_ID} onClick={() => void accept(ranked)}>{accepting === MOVE_ID ? "Paying…" : isCard ? `Pay ${fmtUSD(extra)} extra now` : `Set aside ${fmtUSD(extra)} now`}</button>
        ) : isCard && fallbackAmount > 0 ? (
          <button className="btn" disabled={transferring} onClick={() => void payOnce()}>Pay {fmtUSD(fallbackAmount)} now</button>
        ) : null}
      </div>
      <ActionNote result={move.result} okText={move.okText} />
      {receipt && (
        <div role="status" className={`text-xs mt-2 ${receipt.ok ? "text-good" : "text-bad"}`}>
          {receipt.ok ? (receipt.receipt.length ? receipt.receipt.join(" · ") : "Plan started.") : `Couldn't start: ${receipt.error ?? "unknown error"}`}
          {receipt.ok && receipt.simulated ? " (simulated: demo bank is offline)" : ""}
        </div>
      )}
      <Link href="/credit" className="text-sm font-semibold mt-4 inline-block">Lower card use also lifts your credit score →</Link>
    </Panel>
  );
}

const fmtMonths = (m: number) => (m >= 12 ? `${Math.floor(m / 12)} yr${m >= 24 ? "s" : ""}${m % 12 ? ` ${m % 12} mo` : ""}` : `${m} mo`);

function savedText(r: StrategyResult): string {
  if (r.strategy === "minimums") return r.months === null ? "Never pays off at these minimums" : "Baseline";
  if (r.interestSaved === null || r.monthsSooner === null) return "Minimums alone never pay it off";
  return `Saves ${fmtUSD(r.interestSaved)} · ${fmtMonths(r.monthsSooner)} sooner`;
}

/** Same-budget comparison; all numbers come from compareStrategies (pure, tested). */
function StrategyList({ rows }: { rows: StrategyResult[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted">Nothing with interest to pay down.</p>;
  const sameOrder = rows[0].order.length > 1 && rows[0].order.join() === rows[1].order.join();
  const best = rows.reduce<StrategyResult | null>((acc, r) => (r.interest !== null && (acc === null || (acc.interest ?? Infinity) > r.interest) ? r : acc), null);
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => (
        <li key={r.strategy} className="py-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-semibold">{STRATEGY_TEXT[r.strategy].name}{best?.strategy === r.strategy && r.strategy !== "minimums" && <span className="chip ml-2 text-good">Saves the most</span>}</span>
            <span className="text-sm money">{r.months === null ? "—" : `Debt-free ${fmtMonth(addMonths(AS_OF, r.months))}`}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3 text-xs text-muted">
            <span>{STRATEGY_TEXT[r.strategy].how}</span>
            <span className="money text-right">{r.interest === null ? "" : `${fmtUSD(r.interest)} interest`}</span>
          </div>
          <div className={`text-xs mt-0.5 ${r.strategy === "minimums" ? "text-muted" : "font-semibold"}`}>{savedText(r)}</div>
        </li>
      ))}
      {sameOrder && <li className="pt-2.5 text-xs text-muted">Your highest-rate debt is also your smallest, so avalanche and snowball pay in the same order.</li>}
    </ul>
  );
}
