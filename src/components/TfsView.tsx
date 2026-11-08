"use client";
import type { Analysis } from "@/lib/engine/analyze";
import type { TfsMeta } from "@/lib/server/tfs-meta";
import { fmtUSD } from "@/lib/money";
import { Card } from "./ui/Card";

/** The same customer from Toyota's side (F7). Displays the pack's own numbers; computes nothing new. */
export function TfsView({ analysis, meta }: { analysis: Analysis; meta: TfsMeta }) {
  const { profile, ranked } = analysis;
  const golden = meta.golden.find((g) => g.customer_id === profile.personaId);
  const eligibleIds = new Set(ranked.filter((m) => m.kind === "car" || m.kind === "human").map((m) => m.tfs!.optionId));
  const offers = meta.offers.filter((o) => eligibleIds.has(o.offer_id));
  const drivers = (golden?.value_driver_ids ?? "").split(/[;,|\s]+/).filter(Boolean).map((id) => meta.valueDrivers.find((v) => v.driver_id === id)).filter(Boolean);
  return (
    <div className="space-y-4">
      <Card eyebrow="TFS view · reference answer" title={golden ? golden.best_next_move : "No reference answer"} right={golden && <span className="chip">{golden.next_step_type}</span>}>
        {golden && (
          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            <div><div className="text-[0.7rem] uppercase tracking-wider text-muted">Value if completed</div><div className="money text-xl font-semibold">{golden.value_if_completed_usd === null ? "—" : fmtUSD(golden.value_if_completed_usd)}</div></div>
            <div><div className="text-[0.7rem] uppercase tracking-wider text-muted">Assumed take rate</div><div className="money text-xl font-semibold">{golden.assumed_take_rate === null ? "—" : `${Math.round(golden.assumed_take_rate * 100)}%`}</div></div>
            <div><div className="text-[0.7rem] uppercase tracking-wider text-muted">Expected value</div><div className="money text-xl font-semibold text-good">{golden.expected_value_usd === null ? "—" : fmtUSD(golden.expected_value_usd)}</div></div>
            <div className="sm:col-span-3"><div className="text-[0.7rem] uppercase tracking-wider text-muted">Message to customer</div><p>{golden.plain_language_message}</p></div>
            <div className="sm:col-span-3"><div className="text-[0.7rem] uppercase tracking-wider text-muted">Why not the others</div><p className="text-muted">{golden.why_not_the_others}</p></div>
            {golden.guardrail_notes && <div className="sm:col-span-3"><div className="text-[0.7rem] uppercase tracking-wider text-muted">Guardrails</div><p className="text-warn">{golden.guardrail_notes}</p></div>}
          </div>
        )}
      </Card>

      <Card eyebrow="Eligible offers" title={`${offers.length} offer${offers.length === 1 ? "" : "s"} this customer can see`}>
        <ul className="divide-y divide-line">
          {offers.map((o) => {
            const move = ranked.find((m) => m.tfs?.optionId === o.offer_id);
            return (
              <li key={o.offer_id} className="py-2 grid sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-center text-sm">
                <div><div className="font-medium">{o.offer_name}{move?.goldenMatch && <span className="chip text-good ml-2">reference</span>}</div><div className="text-xs text-muted">{o.eligibility_rule_summary}</div></div>
                <span className="chip">{o.next_step_type}</span>
                <span className="text-xs text-muted">{o.business_value}</span>
                <span className="chip">effort: {o.service_effort}</span>
              </li>
            );
          })}
        </ul>
      </Card>

      {drivers.length > 0 && (
        <Card eyebrow="Value drivers" title="Where the value comes from">
          <ul className="text-sm space-y-1">
            {drivers.map((d) => <li key={d!.driver_id} className="flex justify-between gap-3"><span>{d!.description} <span className="text-muted text-xs">({d!.assumption_text})</span></span><span className="money">{fmtUSD(d!.value_usd)} <span className="text-muted text-xs">{d!.value_type}</span></span></li>)}
          </ul>
        </Card>
      )}
    </div>
  );
}
