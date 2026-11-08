"use client";
import { Panel } from "@/components/nova/ui";
import type { Profile } from "@/lib/engine/types";
import { fmtUSD } from "@/lib/money";

const LEASE_OPTION_IDS = new Set(["RENEW", "BUYOUT", "RETURN", "EXTENDLEASE", "EARLYEND", "TRADE"]);
/** Options that put the customer in a new vehicle: hidden without marketing consent or for vulnerable customers. */
const NEW_VEHICLE_IDS = new Set(["RENEW", "TRADE"]);

/** Toyota option scenarios relevant to leasing, straight from the TFS data pack. */
export function LeaseOptions({ profile, holdBack }: { profile: Profile; holdBack: boolean }) {
  const all = profile.carOptions.filter((o) => LEASE_OPTION_IDS.has(o.option_id));
  const shown = holdBack ? all.filter((o) => !NEW_VEHICLE_IDS.has(o.option_id)) : all;
  const hidden = all.length - shown.length;
  return (
    <Panel title="Lease options from Toyota Financial Services" subtitle="Scenarios TFS prepared for your account">
      {shown.length === 0 && <p className="text-sm text-muted">TFS has no lease scenarios for your account. A lease quote for a specific car comes from a Toyota dealer.</p>}
      <ul className="space-y-3">
        {shown.map((o) => (
          <li key={o.option_id} className="rounded-xl bg-surface-2 p-3">
            <div className="flex flex-wrap justify-between gap-2">
              <b className="text-sm">{o.option_name}</b>
              <span className="chip text-xs">{o.eligibility === "Y" ? "Eligible" : o.eligibility}</span>
            </div>
            <p className="text-sm mt-1">{o.plain_language_summary}</p>
            <div className="text-xs text-muted mt-1 money">
              {o.new_monthly_payment !== null && `New payment ${fmtUSD(o.new_monthly_payment)}/mo · `}
              {o.upfront_cost !== null && `Upfront ${fmtUSD(o.upfront_cost)} · `}
              {o.tradeoff}
            </div>
          </li>
        ))}
      </ul>
      {hidden > 0 && <p className="text-xs text-muted mt-3">{hidden} new-vehicle offer{hidden > 1 ? "s" : ""} hidden: {profile.flags.vulnerable ? "we don't market new cars while you're in a tough spot" : "you haven't opted in to marketing"}.</p>}
      <p className="text-xs text-muted mt-3">Figures from the Toyota Financial Services hackathon data pack. Real offers need a credit check.</p>
    </Panel>
  );
}
