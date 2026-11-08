"use client";
import { useId, useState } from "react";
import { Bar, Panel } from "@/components/nova/ui";
import { AskAi } from "@/components/nova/AskAi";
import { AS_OF, type BankAccount, type Debt } from "@/lib/engine/types";
import { REWARD_RULES, type Rewards } from "@/lib/bank/view";
import { fmtUSD } from "@/lib/money";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const HIGH_USE_PCT = 30;

export interface CardRow { account: BankAccount; debt: Debt | undefined }

/** Card accounts joined to their debt rows (APR, minimum). */
export function cardRows(accounts: BankAccount[], debts: Debt[]): CardRow[] {
  return accounts.filter((a) => a.kind === "card").map((account) => ({ account, debt: debts.find((d) => d.kind === "card" && d.id === account.id) }));
}

/** "Credit card debt" section: one expandable row per card, AI card helper on top. */
export function CreditCards({ cards, rewards }: { cards: CardRow[]; rewards: Rewards }) {
  const total = cards.reduce((s, c) => s + c.account.balance, 0);
  return (
    <Panel title="Credit card debt" subtitle={cards.length ? `${fmtUSD(total)} across ${cards.length} card${cards.length > 1 ? "s" : ""}` : undefined} right={<AskAi topic="which_card" />}>
      {cards.length === 0 && <p className="text-sm text-muted">No credit cards.</p>}
      <ul className="divide-y divide-line">
        {cards.map((c, i) => <CardItem key={c.account.id} card={c} rewards={i === 0 ? rewards : null} defaultOpen={i === 0} />)}
      </ul>
    </Panel>
  );
}

/** The first card (the one with rewards) starts open, so the Rewards bubble lands on its details. */
function CardItem({ card, rewards, defaultOpen }: { card: CardRow; rewards: Rewards | null; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const detailsId = useId();
  const { account: a, debt } = card;
  const limit = a.creditLimit ?? 0;
  const usePct = limit > 0 ? Math.round((a.balance / limit) * 100) : 0;
  return (
    <li className="py-3">
      <button type="button" className="flex w-full items-center gap-3 text-left" aria-expanded={open} aria-controls={detailsId} onClick={() => setOpen((v) => !v)}>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{a.nickname}</div>
          <div className="text-xs text-muted">{usePct}% of {fmtUSD(limit)} limit used{debt ? ` · ${debt.aprPct}% APR` : ""}</div>
        </div>
        <span className="text-sm font-semibold money">{fmtUSD(a.balance)}</span>
        <span aria-hidden className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
        <span className="sr-only">{open ? "Hide" : "Show"} card details</span>
      </button>
      <div className="mt-2"><Bar pct={usePct} tone={usePct > HIGH_USE_PCT ? "bad" : "ink"} marker={HIGH_USE_PCT} /></div>
      {open && (
        <div id={detailsId} className="mt-3 grid gap-3 sm:grid-cols-2">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl bg-surface-2 p-3 text-sm">
            <dt className="text-muted">Limit</dt><dd className="text-right money">{fmtUSD(limit)}</dd>
            <dt className="text-muted">Balance</dt><dd className="text-right money">{fmtUSD(a.balance)}</dd>
            <dt className="text-muted">Available</dt><dd className="text-right money">{fmtUSD(a.available)}</dd>
            <dt className="text-muted">APR</dt><dd className="text-right">{debt ? `${debt.aprPct}%` : "Not on file"}</dd>
            <dt className="text-muted">Utilization</dt><dd className="text-right">{usePct}%</dd>
            {debt && <><dt className="text-muted">Minimum</dt><dd className="text-right money">{fmtUSD(debt.monthlyPayment)}/mo</dd></>}
          </dl>
          {rewards && <RewardsDetails rewards={rewards} />}
        </div>
      )}
    </li>
  );
}

function RewardsDetails({ rewards }: { rewards: Rewards }) {
  const month = MONTH_NAMES[Number(AS_OF.slice(5, 7)) - 1];
  return (
    <div className="rounded-xl bg-surface-2 p-3 text-sm">
      <div className="text-xs font-semibold uppercase text-muted">Rewards</div>
      <div className="mt-1 text-xl font-semibold money">{rewards.points.toLocaleString("en-US")} pts</div>
      <p className="text-xs text-muted">Worth {fmtUSD(rewards.valueCents)} · +{rewards.monthPoints.toLocaleString("en-US")} pts in {month}. 100 points = $1.</p>
      <div className="mt-2 text-xs font-semibold">How you earn</div>
      <ul className="mt-1 space-y-0.5">
        {REWARD_RULES.map((r) => <li key={r.rate} className="flex gap-3"><span className="w-7 font-semibold">{r.rate}x</span><span>{r.label}</span></li>)}
      </ul>
    </div>
  );
}
