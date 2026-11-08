"use client";
import Link from "next/link";
import { NavIcon, hasNavIcon } from "./icons";
import type { ReactNode } from "react";
import type { Analysis } from "@/lib/engine/analyze";
import type { BankView } from "@/lib/bank/view";
import type { BubbleId, BubbleSize } from "@/lib/bank/bubbles";
import { bubbleDef, houseSummary } from "@/lib/bank/bubbles";
import type { Goal } from "@/lib/bank/goals";
import { amortize } from "@/lib/engine/amortize";
import { fmtUSD } from "@/lib/money";
import { CarSpinner } from "@/components/CarSpinner";
import { AreaTrend, Sparkline } from "./charts";
import { NextMoveHero } from "./NextMoveHero";
import { Bar, Row, fmtDate, fmtSigned, fmtWhole, initials } from "./ui";

/** 60-month new-purchase APR by credit tier, from the Toyota rate sheet (data/toyota/rate_sheet.csv). */
const SHOP_APR_60: Record<string, number> = { A: 5.6, B: 7.4, C: 11.1, D: 15.6 };
const SHOP_PRICE = 2_000_000;
const SHOP_TERM = 60;
const RECENT_COUNT = 3;
const SAFETY_SEGMENTS = 6;

/** Grid spans for the Overview and the Edit preview (2 columns on phones, 4 on large screens). */
export const BUBBLE_GRID = "grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 grid-flow-row-dense";
export const BUBBLE_SPAN: Record<BubbleSize, string> = { small: "col-span-1", medium: "col-span-2", large: "col-span-2 lg:col-span-4" };

function Shell({ id, children, right }: { id: BubbleId; children: ReactNode; right?: ReactNode }) {
  const d = bubbleDef(id);
  const iconHref = d.href.split(/[?#]/)[0];
  return (
    <Link href={d.href} className="panel block h-full p-4 hover:border-fg/40 transition-colors">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {hasNavIcon(iconHref) && (
            <span className="h-7 w-7 shrink-0 rounded-full bg-accent-soft text-accent grid place-items-center" aria-hidden>
              <NavIcon href={iconHref} className="h-4 w-4" />
            </span>
          )}
          <h3 className="text-sm font-semibold truncate">{d.title}</h3>
        </div>
        {right ?? <span className="text-muted text-sm" aria-hidden>›</span>}
      </div>
      {children}
    </Link>
  );
}

const Big = ({ children }: { children: ReactNode }) => <div className="money text-xl sm:text-2xl font-semibold leading-tight">{children}</div>;
const Note = ({ children }: { children: ReactNode }) => <div className="text-xs text-muted mt-1">{children}</div>;

function pctChange(now: number, then: number): string {
  if (!then) return "new";
  const pct = Math.round(((now - then) / Math.abs(then)) * 100);
  return `${pct >= 0 ? "↑" : "↓"} ${Math.abs(pct)}% vs last month`;
}

export function Bubble({ id, a, v, goal }: { id: BubbleId; a: Analysis; v: BankView; goal?: Goal & { pct: number } }) {
  const p = a.profile;
  const c = p.contract;
  const hist = v.cashHistory.map((x) => x.value);
  switch (id) {
    case "day_to_day":
      return (
        <Shell id={id}>
          <Big>{fmtUSD(v.checking)}</Big>
          <div className="flex items-end justify-between gap-2"><Note>{pctChange(hist[hist.length - 1], hist[0])}</Note><Sparkline values={hist} /></div>
        </Shell>
      );
    case "net_worth":
      return <Shell id={id}><Big>{fmtWhole(v.netWorth.value)}</Big><Note>{fmtWhole(v.netWorth.own)} own − {fmtWhole(v.netWorth.owe)} owe</Note></Shell>;
    case "debt":
      return <Shell id={id}><Big>{fmtWhole(v.totalDebt)}</Big><Note>{c ? `Mostly your Toyota ${c.type}` : "Cards and loans"}</Note></Shell>;
    case "safety_net": {
      const filled = Math.min(SAFETY_SEGMENTS, Math.floor(v.safetyNet.months));
      return (
        <Shell id={id}>
          <Big>{v.safetyNet.months} months</Big>
          <div className="flex items-end justify-between gap-2">
            <Note>of essentials covered · goal {v.safetyNet.goalMonths}</Note>
            <div className="flex gap-0.5" aria-hidden>{Array.from({ length: SAFETY_SEGMENTS }, (_, i) => <span key={i} className={`h-4 w-1.5 rounded-sm ${i < filled ? "bg-ink" : "bg-line"}`} />)}</div>
          </div>
        </Shell>
      );
    }
    case "credit":
      return <Shell id={id}><Big>{v.credit.score} · {v.credit.label}</Big><Note>Estimate · card use {Math.round(v.credit.utilizationPct)}%</Note></Shell>;
    case "rewards":
      return <Shell id={id}><Big>{v.rewards.points.toLocaleString()} pts</Big><Note>worth about {fmtUSD(v.rewards.valueCents)}</Note></Shell>;
    case "budget_left":
      return <Shell id={id}><Big>{fmtWhole(Math.max(0, v.budget.limit - v.budget.spent))}</Big><Note>of {fmtWhole(v.budget.limit)} for November</Note></Shell>;
    case "accounts":
      return <Shell id={id}><Big>{p.accounts.length + (c ? 1 : 0)} linked</Big><Note>{a.profile.source === "nessie" ? "Live from your bank" : "Offline snapshot"}</Note></Shell>;
    case "total_balance":
      return (
        <Shell id={id} right={<span className="chip">1M</span>}>
          <div className="text-xs text-muted">All cash accounts</div>
          <Big>{fmtUSD(v.cash)}</Big>
          <Note>{pctChange(hist[hist.length - 1], hist[0])}</Note>
          <div className="mt-2"><AreaTrend points={v.cashHistory} height={170} /></div>
        </Shell>
      );
    case "car_financing":
      if (!c || !p.car) return null;
      return (
        <Shell id={id}>
          <div className="text-xs text-muted -mt-1 mb-1">Toyota Financial Services · {p.car.year} {p.car.model} {p.car.trim}</div>
          <div onClick={(e) => e.preventDefault()}><CarSpinner model={p.car.model} year={p.car.year} /></div>
          {c.type === "loan" && v.loan ? (
            <>
              <div className="text-xs text-muted mt-2">Remaining balance</div>
              <Big>{fmtUSD(c.payoffQuote)}</Big>
              <div className="mt-2"><Bar pct={v.loan.pctPaid} /></div>
              <div className="flex justify-between text-xs text-muted mt-1"><span>{v.loan.paymentsMade} of {c.termMonths} payments</span><span>{v.loan.pctPaid}% paid</span></div>
              <Note>Next payment <b className="text-fg">{fmtUSD(c.monthlyPayment)}</b> on {fmtDate(v.loan.nextPaymentDate)}</Note>
            </>
          ) : (
            <>
              <div className="text-xs text-muted mt-2">Lease ends in</div>
              <Big>{c.monthsRemaining} months</Big>
              <div className="mt-2"><Bar pct={(c.monthsElapsed / c.termMonths) * 100} /></div>
              <Note>{fmtUSD(c.monthlyPayment)}/mo · buyout {fmtUSD(c.residual ?? c.payoffQuote)}</Note>
            </>
          )}
        </Shell>
      );
    case "car_shopping": {
      const apr = SHOP_APR_60[p.creditTier] ?? SHOP_APR_60.C;
      const monthly = amortize(SHOP_PRICE, apr, SHOP_TERM);
      return (
        <Shell id={id}>
          <p className="text-lg font-semibold leading-snug">{c?.type === "lease" ? `Your lease ends in ${c.monthsRemaining} month${c.monthsRemaining === 1 ? "" : "s"}` : "Thinking about your next car?"}</p>
          <p className="text-sm mt-2">A {fmtWhole(SHOP_PRICE)} car could be about <b>{fmtWhole(monthly)}/mo</b> over {SHOP_TERM} months at your credit level (est. {apr}% APR).</p>
          <div className="btn w-full mt-3 bg-surface-2">See financing options →</div>
        </Shell>
      );
    }
    case "recent_txns":
      return (
        <Shell id={id} right={<span className="text-sm font-semibold">See all →</span>}>
          {v.ledger.slice(0, RECENT_COUNT).map((t) => (
            <Row key={t.id} icon={initials(t.merchant)} title={t.merchant} sub={`${fmtDate(t.date)} · ${t.accountLabel}`} value={fmtSigned(t.amount)} />
          ))}
        </Shell>
      );
    case "savings_goal":
      if (!goal) {
        return (
          <Shell id={id} right={<span className="btn h-8">Start a goal</span>}>
            <p className="text-sm">You don&apos;t have a savings goal yet.</p>
            <Note>Name something you&apos;re saving for and OneFlow tracks it inside your savings account.</Note>
          </Shell>
        );
      }
      return (
        <Shell id={id} right={<span className="btn h-8">View goal</span>}>
          <div className="text-xs text-muted">{goal.name}</div>
          <div className="money text-2xl font-semibold">{fmtWhole(goal.saved)} <span className="text-sm text-muted font-normal">/ {fmtWhole(goal.target)}</span></div>
          <div className="flex items-center gap-2 mt-2"><div className="flex-1"><Bar pct={goal.pct} /></div><span className="text-xs font-semibold">{goal.pct}%</span></div>
          <Note>{goal.pct >= 75 ? "Keep going! You're almost there." : `${fmtUSD(goal.monthly)}/mo toward it`}</Note>
        </Shell>
      );
    case "house": {
      const h = houseSummary(p.incomeMonthly);
      if (h.limit <= 0) return <Shell id={id}><p className="text-sm text-muted">No income on file, so we can&apos;t estimate a home budget yet.</p></Shell>;
      return (
        <Shell id={id}>
          <div className="text-xs text-muted">Housing payment guideline</div>
          <Big>up to {fmtWhole(h.limit)}/mo</Big>
          <Note>{h.ratioPct}% of your {fmtWhole(p.incomeMonthly)} monthly income</Note>
          <p className="text-sm mt-2">That roughly covers a <b>{fmtWhole(h.price)}</b> home with {h.downPct}% down at {h.aprPct}% over {h.termYears} years.</p>
          <Note>Estimate, not an offer. Principal and interest only. No mortgage linked.</Note>
        </Shell>
      );
    }
    case "next_move":
      return <NextMoveHero />;
  }
}
