"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { RankedMove } from "@/lib/engine/moves/rank";
import { fmtUSD } from "@/lib/money";
import { TwoFutures } from "@/components/TwoFutures";
import { CoachPanel } from "@/components/CoachPanel";
import { useReadyBank } from "./BankProvider";

const HERO_COUNT = 3;
/** Button copy per bank move (wireframe: "Pay card now", "Set up auto-save", "Turn on autopay"). */
const CTA: Record<string, string> = {
  pay_highest_apr: "Pay card now",
  build_runway_3mo: "Set up auto-save",
  idle_cash_to_cd: "Open a CD",
  cancel_recurring: "Cancel it",
  due_date_to_payday: "Move due date",
  set_autopay: "Turn on autopay",
};

function impactLine(m: RankedMove): string {
  if (m.kind === "human") return "A person, not a pitch: we will not show offers here.";
  const amt = fmtUSD(Math.abs(m.impact24));
  return m.impact24 >= 0 ? `About ${amt} better off over 24 months.` : `Costs about ${amt} over 24 months, but lowers risk.`;
}

/** Dark "Next best move" bubble (last on the Overview by default; the person can move it). Rotates through the top 3 engine-ranked moves. */
export function NextMoveHero() {
  const b = useReadyBank();
  // Carousel position belongs to one persona; switching customers starts at their top move.
  const [pos, setPos] = useState({ persona: "", i: 0 });
  const [why, setWhy] = useState(false);
  const moves = b?.analysis.ranked.slice(0, HERO_COUNT) ?? [];
  const i = pos.persona === b?.personaId ? pos.i : 0;
  if (!b || moves.length === 0) return null;
  const m = moves[Math.min(i, moves.length - 1)];
  const receipt = b.receipts.find((r) => r.moveId === m.id);
  const canExecute = !!m.execution?.length && m.kind === "bank";
  const step = (d: number) => setPos({ persona: b.personaId, i: (i + d + moves.length) % moves.length });

  return (
    <>
      <section className="rounded-2xl bg-ink text-ink-fg p-5 sm:p-6" aria-roledescription="carousel" aria-label="Next best move">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-[0.7rem] font-semibold uppercase tracking-wider opacity-70">
              Next best move · {i + 1} of {moves.length}
              {m.goldenMatch && <span className="ml-2 normal-case tracking-normal">✓ matches Toyota&apos;s reference</span>}
            </div>
            <h2 className="mt-1 text-lg sm:text-xl font-semibold leading-snug">{m.title}</h2>
            <p className="mt-1 text-sm opacity-80 max-w-3xl">{m.why} {impactLine(m)}</p>
            {receipt && (
              <p className="mt-2 text-xs opacity-90" role="status">
                {receipt.ok ? (receipt.simulated ? "Done (offline demo: simulated)." : receipt.settled ? "Done. Posted in your bank." : "Sent to your bank… waiting for it to post.") : `Couldn't do that: ${receipt.error}`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            {canExecute ? (
              <button className="btn btn-on-ink" disabled={b.accepting === m.id || (receipt?.ok ?? false)} onClick={() => void b.accept(m)}>
                {b.accepting === m.id ? "Working…" : receipt?.ok ? "Done ✓" : CTA[m.id] ?? "Do it"}
              </button>
            ) : (
              <Link className="btn btn-on-ink" href="/car">{m.kind === "human" ? "Talk to a specialist" : "See car options"}</Link>
            )}
            <button className="btn btn-ghost-ink" onClick={() => setWhy(true)}>Why this?</button>
            {moves.length > 1 && (
              <span className="flex gap-2 ml-auto sm:ml-0">
                <button className="btn btn-ghost-ink w-9 px-0" aria-label="Previous move" onClick={() => step(-1)}>‹</button>
                <button className="btn btn-ghost-ink w-9 px-0" aria-label="Next move" onClick={() => step(1)}>›</button>
              </span>
            )}
          </div>
        </div>
      </section>
      {why && <WhyDrawer move={m} personaId={b.personaId} onClose={() => setWhy(false)} />}
    </>
  );
}

function WhyDrawer({ move, personaId, onClose }: { move: RankedMove; personaId: string; onClose: () => void }) {
  const [brief, setBrief] = useState<string | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose} role="dialog" aria-modal aria-label={`Why: ${move.title}`}>
      <div className="h-full w-full max-w-xl overflow-y-auto bg-bg p-4 sm:p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted">Why this move</div>
            <h2 className="text-xl font-semibold">{move.title}</h2>
          </div>
          <button className="btn w-9 px-0" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <div className="panel p-4 space-y-2 text-sm">
          <p>{move.why}</p>
          {move.kind !== "human" && (
            <p className="money text-2xl font-semibold">{move.impact24 >= 0 ? "+" : "−"}{fmtUSD(Math.abs(move.impact24))} <span className="text-xs text-muted font-normal">net worth by month 24 vs doing nothing</span></p>
          )}
          {move.tfs && (
            <div className="grid sm:grid-cols-2 gap-2 pt-2 border-t border-line">
              <div><div className="text-xs text-muted">Toyota estimate vs keeping as-is</div><div className="money">{move.tfs.tfsTotalVsKeep === null ? "n/a" : fmtUSD(-move.tfs.tfsTotalVsKeep)}</div></div>
              <div><div className="text-xs text-muted">Next step</div><div>{move.tfs.nextStepType}</div></div>
              {move.tfs.tradeoff && <div className="sm:col-span-2"><div className="text-xs text-muted">Trade-off</div><div>{move.tfs.tradeoff}</div></div>}
            </div>
          )}
        </div>
        {move.kind !== "human" && (
          <div className="panel p-4">
            <h3 className="font-semibold mb-2">Two futures</h3>
            <TwoFutures baseline={move.baseline} applied={move.applied} appliedLabel={move.title} />
            <p className="text-xs text-muted mt-2">Every number here comes from OneFlow&apos;s projection engine, not the AI.</p>
          </div>
        )}
        {brief && <div className="panel p-4 text-sm whitespace-pre-wrap leading-relaxed">{brief}</div>}
        <CoachPanel personaId={personaId} onBrief={setBrief} />
      </div>
    </div>
  );
}
