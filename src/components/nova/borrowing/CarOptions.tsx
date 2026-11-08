"use client";
import { Panel, fmtSigned } from "@/components/nova/ui";
import { useBank } from "@/components/nova/BankProvider";
import type { RankedMove } from "@/lib/engine/moves/rank";

/** Only the top-ranked car moves; the engine ranks them best first. */
const MAX_OPTIONS = 2;

/** Toyota car moves from the ranked engine. A vulnerable customer gets only the specialist card. */
export function CarOptions({ ranked }: { ranked: RankedMove[] }) {
  const human = ranked.find((m) => m.kind === "human");
  if (human) return <SpecialistCard move={human} />;
  const cars = ranked.filter((m) => m.kind === "car").slice(0, MAX_OPTIONS);
  if (cars.length === 0) return null;
  return (
    <section className="mt-4">
      <h2 className="font-semibold mb-3">Your options</h2>
      <div className="grid gap-4 lg:grid-cols-2">{cars.map((m) => <OptionCard key={m.id} move={m} />)}</div>
    </section>
  );
}

function SpecialistCard({ move }: { move: RankedMove }) {
  return (
    <section className="mt-4">
      <Panel title="Talk to a specialist" subtitle="A person at Toyota Financial Services, not an offer">
        <p className="text-sm">{move.why}</p>
        {move.tfs?.plainSummary && <p className="text-sm text-muted mt-2">{move.tfs.plainSummary}</p>}
      </Panel>
    </section>
  );
}

function OptionCard({ move }: { move: RankedMove }) {
  const { accept, accepting, receipts } = useBank();
  const receipt = receipts.find((r) => r.moveId === move.id);
  return (
    <Panel
      title={move.title}
      right={move.goldenMatch ? <span className="chip text-good" title="Top car move equals Toyota's reference answer">✓ matches TFS reference</span> : undefined}
    >
      <p className="text-sm">{move.why}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="chip money">{fmtSigned(move.impact24)} net worth by month 24</span>
        {move.tfs && <span className="chip">Next step: {move.tfs.nextStepType}</span>}
        {move.tfs && move.tfs.eligibility !== "Y" && <span className="chip">TFS eligibility: {move.tfs.eligibility}</span>}
      </div>
      {move.tfs?.tradeoff && <p className="text-xs text-muted mt-2">Trade-off: {move.tfs.tradeoff}</p>}
      {move.execution && move.execution.length > 0 && (
        <button type="button" className="btn btn-primary mt-3" disabled={accepting === move.id} onClick={() => void accept(move)}>
          {accepting === move.id ? "Working…" : "Do this in OneFlow"}
        </button>
      )}
      {receipt && (
        <p className={`text-xs mt-2 ${receipt.ok ? "text-good" : "text-bad"}`} role="status">
          {receipt.ok ? (receipt.simulated ? "Done (simulated, offline)." : "Done in your bank.") : `Couldn't do it: ${receipt.error ?? "unknown error"}`}
        </p>
      )}
    </Panel>
  );
}
