"use client";
import Link from "next/link";
import { Panel, fmtMonth } from "@/components/nova/ui";
import { useReadyBank } from "@/components/nova/BankProvider";
import { fmtUSD } from "@/lib/money";
import { AS_OF } from "@/lib/engine/types";
import { addMonths, payoffWithExtra } from "@/lib/bank/view";
import type { RankedDebt } from "@/lib/bank/wealth";
import { ActionNote } from "./ActionNote";
import { useMoneyMove } from "./useMoneyMove";

const MOVE_ID = "pay_highest_apr";
const FALLBACK_SHARE = 0.1;
const MIN_EXTRA = 2_500;

export function PayoffPlan({ target }: { target: RankedDebt }) {
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
  const isCard = d.kind === "card";
  const canPayFull = isCard && view.checking >= d.balance;
  const receipt = receipts.find((r) => r.moveId === MOVE_ID);
  const fallbackAmount = Math.min(monthly, d.balance, view.checking);

  const payFull = () => move.run(() => transfer("checking", "card", d.balance, `Card payment: ${d.label}`.slice(0, 80)), `Paid ${fmtUSD(d.balance)} to ${d.label}.`);
  const payOnce = () => move.run(() => transfer("checking", "card", fallbackAmount, `Card payment: ${d.label}`.slice(0, 80)), `Paid ${fmtUSD(fallbackAmount)} to ${d.label}.`);

  return (
    <Panel title="Payoff plan" subtitle="Highest rate first saves the most interest">
      <div className="grid gap-3">
        {canPayFull && (
          <div className="rounded-xl bg-surface-2 p-3">
            <div className="text-xs text-muted">Option A</div>
            <div className="font-semibold">Pay the card in full today</div>
            <p className="text-sm text-muted">{fmtUSD(d.balance)} from checking. You&apos;d still have {fmtUSD(view.checking - d.balance)} there.</p>
          </div>
        )}
        <div className="rounded-xl bg-surface-2 p-3">
          <div className="text-xs text-muted">Option {canPayFull ? "B" : "A"}</div>
          <div className="font-semibold">Pay {fmtUSD(monthly)} a month</div>
          <p className="text-sm text-muted">{isCard ? "Each payment posts to your card in the bank. " : "Toyota loans can't be paid from here yet, so the extra is set aside in savings. "}{Number.isFinite(plan.months) ? `${d.label} paid off by ${fmtMonth(addMonths(AS_OF, plan.months))}, about ${fmtUSD(plan.interest)} in interest.` : "That still doesn't cover the interest."}</p>
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
