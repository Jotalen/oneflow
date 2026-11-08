"use client";
import type { RankedMove } from "@/lib/engine/moves/rank";
import { fmtUSD } from "@/lib/money";
import { Card } from "./ui/Card";
import { TwoFutures } from "./TwoFutures";

const KIND_LABEL: Record<RankedMove["impactKind"], string> = { netWorth: "net worth by month 24", fees: "fees avoided (est.)", risk: "estimated value" };

export function MoveCard({ move, rank, onAccept, accepting }: { move: RankedMove; rank: number; onAccept?: (m: RankedMove) => void; accepting?: boolean }) {
  const isHuman = move.kind === "human";
  const impact = move.impact24;
  const sign = impact > 0 ? "+" : "";
  return (
    <Card
      eyebrow={`#${rank} · ${move.kind === "car" ? "Your Toyota" : move.kind === "bank" ? "Your bank" : "Guardrail"}`}
      title={move.title}
      right={move.goldenMatch ? <span className="chip text-good" title="Top car move equals Toyota's reference answer">✓ matches TFS reference</span> : null}
      expandable
      expanded={
        <div className="space-y-4">
          <TwoFutures baseline={move.baseline} applied={move.applied} appliedLabel={move.title} />
          {move.tfs && (
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div><div className="text-muted text-xs">TFS estimate vs keep as-is</div><div className="money">{move.tfs.tfsTotalVsKeep === null ? "n/a" : fmtUSD(-move.tfs.tfsTotalVsKeep)}</div></div>
              <div><div className="text-muted text-xs">Next step</div><div>{move.tfs.nextStepType}</div></div>
              {move.tfs.assumption && <div className="sm:col-span-2"><div className="text-muted text-xs">Assumption</div><div>{move.tfs.assumption}</div></div>}
              {move.tfs.tradeoff && <div className="sm:col-span-2"><div className="text-muted text-xs">Trade-off</div><div>{move.tfs.tradeoff}</div></div>}
            </div>
          )}
          {move.execution && onAccept && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAccept(move); }}
              disabled={accepting}
              className="glass px-4 py-2 text-sm font-semibold hover:border-accent disabled:opacity-50"
            >
              {accepting ? "Posting to Nessie…" : "Accept — execute in the bank"}
            </button>
          )}
        </div>
      }
    >
      {isHuman ? (
        <div className="text-2xl font-semibold text-warn">A person, not a pitch.</div>
      ) : (
        <div className="flex items-baseline gap-2">
          <div className={`money text-3xl sm:text-4xl font-semibold ${impact >= 0 ? "text-good" : "text-bad"}`}>{sign}{fmtUSD(impact)}</div>
          <div className="text-xs text-muted">{KIND_LABEL[move.impactKind]}</div>
        </div>
      )}
      <p className="mt-2 text-sm text-muted leading-snug">{move.why}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {move.nextStep && <span className="chip">{move.nextStep}</span>}
        {move.tfs && move.tfs.eligibility !== "Y" && <span className="chip text-warn">{move.tfs.eligibility}</span>}
      </div>
    </Card>
  );
}
