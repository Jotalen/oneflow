"use client";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/nova/ui";
import { Loading } from "@/components/nova/Loading";
import { useReadyBank } from "@/components/nova/BankProvider";
import { fmtUSD } from "@/lib/money";
import { AS_OF } from "@/lib/engine/types";
import { creditFactors, creditSteps, type CreditFactor, type CreditInputs, type CreditStep } from "@/lib/bank/credit";
import { Gauge } from "@/components/nova/wealth/Gauge";
import { CreditGoalPanel } from "@/components/nova/borrowing/CreditGoal";

const TITLE = "Credit score";
const SUB = "Estimate · based on what OneFlow can see. Checking here never affects your score.";
const RATING_TONE: Record<CreditFactor["rating"], string> = { Excellent: "text-good", Good: "text-good", Fair: "", "Needs work": "text-bad" };

export default function CreditPage() {
  const b = useReadyBank();
  if (!b) return <><PageHeader title={TITLE} subtitle={SUB} /><Loading /></>;
  const { analysis, view, personaId } = b;
  const p = analysis.profile;
  const cr = view.credit;
  const inputs: CreditInputs = { tier: p.creditTier, age: p.age, utilizationPct: cr.utilizationPct, missed12m: p.flags.missed12m, accounts: cr.accounts, contractStart: p.contract?.contractStart, asOf: AS_OF };
  const factors = creditFactors(inputs);
  const steps = creditSteps({ ...inputs, cardBalance: view.cardBalance, cardLimit: view.cardLimit, autopay: p.flags.autopay });

  return (
    <>
      <PageHeader title={TITLE} subtitle={SUB} />
      <div className="grid gap-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Your score" right={<span className="chip">Estimate</span>}>
            <Gauge score={cr.score} label={cr.label} />
            <p className="text-xs text-muted text-center mt-2">Estimated from your Toyota credit tier, card use and payment history. Not a bureau score.</p>
          </Panel>
          <CreditGoalPanel persona={personaId} inputs={{ asOf: AS_OF, tier: p.creditTier, utilizationPct: cr.utilizationPct, missed12m: p.flags.missed12m, cardBalance: view.cardBalance, cardLimit: view.cardLimit, current: cr.score }} />
        </div>
        <FactorList factors={factors} />
        <StepList steps={steps} />
      </div>
    </>
  );
}

function FactorList({ factors }: { factors: CreditFactor[] }) {
  return (
    <Panel title="What shapes your score" subtitle="“Estimate” marks values we infer from your Toyota credit tier and profile; the rest is real account data.">
      <ul className="divide-y divide-line">
        {factors.map((f) => (
          <li key={f.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1.2fr_1fr_auto_2fr] gap-x-3 gap-y-1 py-3 text-sm items-center">
            <span className="font-semibold">{f.name}{f.estimated && <span className="chip ml-2 text-xs">Estimate</span>}</span>
            <span className="text-right sm:text-left"><span className="font-semibold money">{f.value}</span> <span className={`text-xs ${RATING_TONE[f.rating]}`}>{f.rating}</span></span>
            <span><span className={`chip ${f.impact === "High impact" ? "bg-ink text-ink-fg" : ""}`}>{f.impact}</span></span>
            <span className="text-xs text-muted col-span-2 sm:col-span-1">{f.note}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function StepList({ steps }: { steps: CreditStep[] }) {
  return (
    <Panel title="Steps to raise your score" subtitle="Worked out from your factors above. Point gains are from our estimate.">
      <ol className="divide-y divide-line">
        {steps.map((s, i) => (
          <li key={s.id} className="flex gap-3 py-3">
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">{s.title}</span>
                {s.points !== null && s.points > 0 && <span className="chip text-good">+{s.points} pts · estimate</span>}
              </div>
              <p className="text-xs text-muted mt-0.5">{s.amount !== null && <><b className="text-fg money">About {fmtUSD(s.amount)}.</b> </>}{s.detail}</p>
              {s.amount !== null && <Link href="/debt" className="text-xs font-semibold mt-1 inline-block">Pay from Debt &amp; liquidity →</Link>}
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
