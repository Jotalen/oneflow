"use client";
import { useState } from "react";
import { PageHeader, Panel } from "@/components/nova/ui";
import { Loading } from "@/components/nova/Loading";
import { useReadyBank } from "@/components/nova/BankProvider";
import { fmtUSD } from "@/lib/money";
import { estimateCreditScore } from "@/lib/bank/view";
import { cappedPayment, paymentToReachUtil } from "@/lib/bank/wealth";
import { Gauge } from "@/components/nova/wealth/Gauge";
import { ActionNote } from "@/components/nova/wealth/ActionNote";
import { useMoneyMove } from "@/components/nova/wealth/useMoneyMove";

const TITLE = "Credit score";
const SUB = "Estimate · based on what OneFlow can see. Checking here never affects your score.";
const LOW_USE_PCT = 10;
const TARGET_UTIL_PCT = 9;
const OK_USE_PCT = 30;

interface Factor { name: string; value: string; impact: "High impact" | "Medium" | "Low"; note: string }

function cardUseLabel(pct: number): string {
  if (pct < LOW_USE_PCT) return "Excellent";
  if (pct <= OK_USE_PCT) return `Fair · aim under ${LOW_USE_PCT}%`;
  return `High · aim under ${LOW_USE_PCT}%`;
}

export default function CreditPage() {
  const b = useReadyBank();
  const [why, setWhy] = useState(false);
  const move = useMoneyMove();
  if (!b) return <><PageHeader title={TITLE} subtitle={SUB} /><Loading /></>;
  const { analysis, view, transfer, transferring } = b;
  const p = analysis.profile;
  const cr = view.credit;
  const missed = p.flags.missed12m;
  const projected = estimateCreditScore({ tier: p.creditTier, utilizationPct: TARGET_UTIL_PCT, missed12m: missed });
  const card = p.debts.find((d) => d.kind === "card");
  const needed = paymentToReachUtil(view.cardBalance, view.cardLimit, LOW_USE_PCT);
  const payNow = cappedPayment(needed, view.checking);
  const cardName = card?.label ?? "your card";

  const factors: Factor[] = [
    { name: "On-time payments", value: `${cr.onTimePct}%`, impact: "High impact", note: missed ? `${missed} missed in the last 12 months` : "No missed payments in 12 months" },
    { name: "Card use", value: `${Math.round(cr.utilizationPct)}% of your limit`, impact: "High impact", note: cardUseLabel(cr.utilizationPct) },
    { name: "Total accounts", value: String(cr.accounts), impact: "Low", note: "Accounts we can see at OneFlow and Toyota" },
    { name: "Credit tier", value: `Tier ${p.creditTier}`, impact: "Medium", note: "From Toyota Financial Services" },
  ];

  const pay = () => move.run(() => transfer("checking", "card", payNow, `Card payment: ${cardName}`.slice(0, 80)), `Paid ${fmtUSD(payNow)} to ${cardName}.`);

  return (
    <>
      <PageHeader title={TITLE} subtitle={SUB} />
      <div className="grid gap-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Your score" right={<span className="chip">Estimate</span>}>
            <Gauge score={cr.score} label={cr.label} />
            <p className="text-xs text-muted text-center mt-2">Estimated from your Toyota credit tier, card use and payment history. Not a bureau score.</p>
          </Panel>
          <Panel title="What would move it" subtitle="Same estimate, one thing changed">
            {cr.utilizationPct < LOW_USE_PCT ? (
              <p className="text-sm">Your card use is already under {LOW_USE_PCT}%, the best range for this factor. Keep paying on time.</p>
            ) : (
              <>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-semibold">{projected.score}</span>
                  <span className="text-sm text-muted">{projected.label} · {projected.score - cr.score >= 0 ? "+" : ""}{projected.score - cr.score} points</span>
                </div>
                <p className="text-sm text-muted mt-2">If card use dropped from {Math.round(cr.utilizationPct)}% to under {LOW_USE_PCT}%.</p>
              </>
            )}
            <p className="text-xs text-muted mt-4">We don&apos;t have your score history, so there&apos;s no trend chart here.</p>
          </Panel>
        </div>

        <Panel title="What shapes your score">
          <ul className="divide-y divide-line">
            {factors.map((f) => (
              <li key={f.name} className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-3 text-sm items-center">
                <span className="font-semibold">{f.name}</span>
                <span>{f.value}</span>
                <span><span className={`chip ${f.impact === "High impact" ? "bg-ink text-ink-fg" : ""}`}>{f.impact}</span></span>
                <span className="text-muted">{f.note}</span>
              </li>
            ))}
          </ul>
        </Panel>

        {needed > 0 && card && (
          <section className="panel p-4 sm:p-5 border-2 border-fg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase text-muted">Biggest quick win</div>
                <div className="font-semibold mt-1">Pay {fmtUSD(needed)} on your {cardName}</div>
                <p className="text-xs text-muted">That brings card use under {LOW_USE_PCT}%.{payNow < needed ? ` Checking covers ${fmtUSD(payNow)} today.` : ""}</p>
              </div>
              <div className="flex gap-2">
                {payNow > 0 && <button className="btn btn-primary" disabled={transferring} onClick={() => void pay()}>{transferring ? "Paying…" : `Make a ${fmtUSD(payNow)} payment`}</button>}
                <button className="btn" aria-expanded={why} onClick={() => setWhy((v) => !v)}>Why it matters</button>
              </div>
            </div>
            {why && <p className="text-sm text-muted mt-3">Card use is how much of your limit you&apos;re using. Lenders read high use as risk, so it&apos;s one of the biggest factors. In our estimate, dropping under {LOW_USE_PCT}% moves you to about {projected.score}. Real bureau scores usually update after your next statement.</p>}
            <ActionNote result={move.result} okText={move.okText} />
          </section>
        )}
      </div>
    </>
  );
}
