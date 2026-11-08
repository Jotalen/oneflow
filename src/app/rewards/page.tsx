"use client";
import { useState } from "react";
import { PageHeader, Panel, Row, Empty, fmtDate, initials } from "@/components/nova/ui";
import { Loading } from "@/components/nova/Loading";
import { useReadyBank } from "@/components/nova/BankProvider";
import { useStored } from "@/components/nova/everyday/useStored";
import { RedeemPanel } from "@/components/nova/everyday/RedeemPanel";
import { CATEGORY_LABEL } from "@/lib/bank/view";
import { availablePoints, type Redemption } from "@/lib/bank/everyday";
import { AS_OF } from "@/lib/engine/types";
import { fmtUSD } from "@/lib/money";

const TITLE = "Rewards";
const SUBTITLE = "Points from your NovaBank rewards card.";
const EARN = [
  { rate: "3x", what: "Dining and takeout" },
  { rate: "2x", what: "Groceries and gas" },
  { rate: "1x", what: "Everything else" },
];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function RewardsPage() {
  const b = useReadyBank();
  const [howOpen, setHowOpen] = useState(false);
  const [redemptions, setRedemptions] = useStored<Redemption[]>("rewards", b?.personaId ?? "", []);
  if (!b) return <><PageHeader title={TITLE} subtitle={SUBTITLE} /><Loading /></>;
  const { analysis, view } = b;
  const hasCard = analysis.profile.accounts.some((a) => a.kind === "card");
  if (!hasCard) return <><PageHeader title={TITLE} subtitle={SUBTITLE} /><Empty title="No rewards card" body="Rewards points are earned on a NovaBank credit card. This customer doesn't have one." /></>;
  const r = view.rewards;
  const available = availablePoints(r.points, redemptions);
  const month = MONTH_NAMES[Number(AS_OF.slice(5, 7)) - 1];

  return (
    <>
      <PageHeader title={TITLE} subtitle={SUBTITLE} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Points balance">
          <div className="text-4xl font-semibold money">{available.toLocaleString()} pts</div>
          <p className="text-sm text-muted mt-1">Worth <span className="font-semibold text-fg">{fmtUSD(available)}</span> · +{r.monthPoints.toLocaleString()} pts earned in {month}</p>
          {redemptions.length > 0 && <p className="text-xs text-muted mt-1">{r.points.toLocaleString()} earned − {(r.points - available).toLocaleString()} redeemed</p>}
          <div className="flex flex-wrap gap-2 mt-4">
            <a href="#redeem" className="btn btn-primary">Redeem points</a>
            <button className="btn" aria-expanded={howOpen} onClick={() => setHowOpen((o) => !o)}>How points work</button>
          </div>
          {howOpen && <p className="text-sm text-muted mt-3">You earn points on card purchases at the rates shown. 100 points = $1. Points are calculated from the purchases on your card in your last 8 weeks of records.</p>}
        </Panel>
        <Panel title="How you earn">
          <ul className="divide-y divide-line">
            {EARN.map((e) => <li key={e.rate} className="flex items-center gap-4 py-2.5"><span className="text-xl font-semibold w-10">{e.rate}</span><span className="text-sm">{e.what}</span></li>)}
          </ul>
        </Panel>
      </div>
      <h2 id="redeem" className="font-semibold mt-6 mb-3 scroll-mt-4">Ways to redeem</h2>
      <RedeemPanel available={available} redemptions={redemptions} onRedeem={(x) => setRedemptions([x, ...redemptions])} />
      <div className="mt-4">
        <Panel title="Recent points">
          {r.recent.length === 0 ? <p className="text-sm text-muted">No card purchases yet.</p> : r.recent.map((e) => (
            <Row key={e.txn.id} icon={initials(e.txn.merchant)} title={e.txn.merchant}
              sub={`${fmtDate(e.txn.date)} · ${fmtUSD(Math.abs(e.txn.amount))} at ${e.rate}x${e.rate > 1 ? ` ${CATEGORY_LABEL[e.txn.category].toLowerCase()}` : ""}`}
              value={`+${e.points} pts`} />
          ))}
        </Panel>
      </div>
    </>
  );
}
