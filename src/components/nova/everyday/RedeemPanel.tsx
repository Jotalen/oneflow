"use client";
import { useState, type FormEvent } from "react";
import { Panel } from "@/components/nova/ui";
import type { Redemption } from "@/lib/bank/everyday";
import { fmtUSD } from "@/lib/money";

const MIN_REDEEM = 100;
/** 100 points = $1, i.e. 1 point = 1 cent (same rule as rewardsFor). */
const CENTS_PER_POINT = 1;

/** Statement-credit redemption recorded locally: Nessie has no rewards ledger, so no money moves. */
export function RedeemPanel({ available, redemptions, onRedeem }: { available: number; redemptions: Redemption[]; onRedeem: (r: Redemption) => void }) {
  const [raw, setRaw] = useState(String(available));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const pts = Math.floor(Number(raw));
    if (!Number.isFinite(pts) || pts < MIN_REDEEM) { setMsg({ ok: false, text: `Redeem at least ${MIN_REDEEM} points.` }); return; }
    if (pts > available) { setMsg({ ok: false, text: `You have ${available.toLocaleString()} points available.` }); return; }
    const value = pts * CENTS_PER_POINT;
    onRedeem({ id: `r${Date.now()}`, points: pts, at: new Date().toISOString().slice(0, 10), label: `${fmtUSD(value)} statement credit` });
    setRaw(String(available - pts));
    setMsg({ ok: true, text: `Redeemed ${pts.toLocaleString()} pts for a ${fmtUSD(value)} statement credit.` });
  };

  return (
    <Panel title="Statement credit" subtitle={`${MIN_REDEEM} pts = $1 off your card balance`}>
      {available < MIN_REDEEM ? <p className="text-sm text-muted">You need at least {MIN_REDEEM} points to redeem.</p> : (
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted flex flex-col gap-1">Points to redeem
            <input inputMode="numeric" className="w-32 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-fg" value={raw} onChange={(e) => setRaw(e.target.value)} />
          </label>
          <button type="submit" className="btn btn-primary">Redeem {Number(raw) >= MIN_REDEEM ? fmtUSD(Math.floor(Number(raw)) * CENTS_PER_POINT) : ""}</button>
        </form>
      )}
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm mt-2 ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</p>}
      <p className="text-[0.7rem] text-muted mt-2">Demo: Nessie has no rewards ledger, so redemptions are recorded on this device and your card balance does not change.</p>
      {redemptions.length > 0 && (
        <ul className="mt-3 border-t border-line pt-2 text-sm">
          {redemptions.map((r) => <li key={r.id} className="flex justify-between py-1"><span>{r.label} <span className="text-muted">· {r.at}</span></span><span className="money">−{r.points.toLocaleString()} pts</span></li>)}
        </ul>
      )}
    </Panel>
  );
}
