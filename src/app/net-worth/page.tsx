"use client";
import { useState } from "react";
import Link from "next/link";
import { PageHeader, Panel, Tile, Segmented, fmtSigned } from "@/components/nova/ui";
import { AreaTrend } from "@/components/nova/charts";
import { Loading } from "@/components/nova/Loading";
import { useReadyBank } from "@/components/nova/BankProvider";
import { AssetForm } from "@/components/nova/wealth/AssetForm";
import { useOwnedAssets } from "@/components/nova/wealth/useOwnedAssets";
import { fmtUSD } from "@/lib/money";
import { AS_OF } from "@/lib/engine/types";
import type { NetWorthPart } from "@/lib/bank/view";
import { cashChange, debtPaidInMonth, netWorthSeries, netWorthWithExtras, type OwnedAsset, type OwnPart } from "@/lib/bank/wealth";

type Range = "1M" | "3M" | "6M" | "1Y" | "All";
const RANGES: { value: Range; label: string; disabled?: boolean }[] = [
  { value: "1M", label: "1M" },
  ...(["3M", "6M", "1Y", "All"] as const).map((r) => ({ value: r, label: r, disabled: true })),
];
const SHADES = ["bg-ink", "bg-muted", "bg-line"];
const TITLE = "Net worth";
const SUB = "Everything you own minus everything you owe.";
const ASSET_PREFIX = "asset:";

function SplitBar({ parts, total }: { parts: NetWorthPart[]; total: number }) {
  if (total <= 0) return <div className="h-2 rounded-full bg-line" />;
  return (
    <div className="flex h-2 rounded-full overflow-hidden gap-0.5 bg-line" aria-hidden>
      {parts.map((p, i) => <div key={p.key} className={SHADES[i % SHADES.length]} style={{ width: `${(p.value / total) * 100}%` }} />)}
    </div>
  );
}

interface AssetActions { editingId: string | null; onEdit: (id: string | null) => void; onSave: (id: string, a: Omit<OwnedAsset, "id">) => void; onRemove: (id: string) => void }

function PartRow({ p, i, actions }: { p: OwnPart; i: number; actions?: AssetActions }) {
  const assetId = p.estimate ? p.key.slice(ASSET_PREFIX.length) : null;
  if (assetId && actions?.editingId === assetId) {
    return (
      <li className="py-2.5">
        <AssetForm initial={{ name: p.label, value: p.value }} submitLabel="Save" onSubmit={(a) => actions.onSave(assetId, a)} onCancel={() => actions.onEdit(null)} />
      </li>
    );
  }
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className={`mt-1.5 h-2.5 w-2.5 rounded-sm shrink-0 ${SHADES[i % SHADES.length]}`} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold truncate">{p.label}</div>
        <div className="text-xs text-muted mt-0.5">{p.estimate ? <span className="chip">Your estimate</span> : p.detail}</div>
        {assetId && actions && (
          <div className="flex gap-4 mt-1.5 text-xs font-semibold">
            <button type="button" className="underline-offset-2 hover:underline" onClick={() => actions.onEdit(assetId)} aria-label={`Edit ${p.label}`}>Edit</button>
            <button type="button" className="underline-offset-2 hover:underline text-bad" onClick={() => actions.onRemove(assetId)} aria-label={`Remove ${p.label}`}>Remove</button>
          </div>
        )}
      </div>
      <div className="text-sm font-semibold money">{fmtUSD(p.value)}</div>
    </li>
  );
}

function PartList({ parts, actions }: { parts: OwnPart[]; actions?: AssetActions }) {
  return <ul className="divide-y divide-line mt-3">{parts.map((p, i) => <PartRow key={p.key} p={p} i={i} actions={actions} />)}</ul>;
}

export default function NetWorthPage() {
  const b = useReadyBank();
  const [range, setRange] = useState<Range>("1M");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { assets, add, update, remove } = useOwnedAssets(b?.personaId ?? "");
  if (!b) return <><PageHeader title={TITLE} subtitle={SUB} /><Loading /></>;
  const { view, analysis } = b;
  const nw = netWorthWithExtras(view.netWorth, analysis.profile.accounts, assets);
  const series = netWorthSeries(view.cashHistory, nw.value, view.cash);
  const change30 = cashChange(view.cashHistory);
  const paidDown = debtPaidInMonth(view.ledger, AS_OF.slice(0, 7));
  const changes = [
    { label: "Cash change · last 30 days", value: change30 },
    ...(paidDown > 0 ? [{ label: "Card debt paid down this month", value: paidDown }] : []),
  ];
  const actions: AssetActions = {
    editingId,
    onEdit: setEditingId,
    onSave: (id, a) => { update(id, a); setEditingId(null); },
    onRemove: (id) => { remove(id); if (editingId === id) setEditingId(null); },
  };
  return (
    <>
      <PageHeader title={TITLE} subtitle={SUB} />
      <div className="grid gap-4">
        <Panel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-4xl sm:text-5xl font-semibold money tracking-tight">{fmtUSD(nw.value)}</div>
              <p className="text-sm mt-1">{fmtSigned(change30)} over the last 30 days</p>
              <p className="text-xs text-muted">{fmtUSD(nw.own)} you own − {fmtUSD(nw.owe)} you owe</p>
              {nw.estimates > 0 && <p className="text-xs text-muted">Includes {fmtUSD(nw.estimates)} of your own estimates</p>}
            </div>
            <div title="Needs more history: we have the last 30 days">
              <Segmented value={range} options={RANGES} onChange={setRange} size="sm" />
            </div>
          </div>
          <div className="mt-4"><AreaTrend points={series} height={200} /></div>
          <p className="text-xs text-muted mt-1">Last 30 days. Longer ranges need more history. Car value and your own estimates are held at today&apos;s figures.</p>
          <Link href="/what-if" className="btn mt-3">Try a what-if: see the next 24 months</Link>
        </Panel>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="What you own" right={<span className="font-semibold money">{fmtUSD(nw.own)}</span>}>
            <SplitBar parts={nw.ownParts} total={nw.own} />
            <PartList parts={nw.ownParts} actions={actions} />
            {adding ? (
              <AssetForm submitLabel="Add" onSubmit={(a) => { add(a); setAdding(false); }} onCancel={() => setAdding(false)} />
            ) : (
              <button type="button" className="btn mt-3 text-sm" onClick={() => setAdding(true)}>+ Add something you own</button>
            )}
            <p className="text-xs text-muted mt-2">Add big things we can&apos;t see, like a home, a car not financed with us, a boat or jewelry. They count toward your net worth as your estimate.</p>
          </Panel>
          <Panel title="What you owe" right={<span className="font-semibold money">{fmtUSD(nw.owe)}</span>}>
            <SplitBar parts={nw.owePart} total={nw.owe} />
            {nw.owePart.length ? <PartList parts={nw.owePart} /> : <p className="text-sm text-muted mt-3">No balances owed.</p>}
          </Panel>
        </div>

        <Panel title="What changed this month">
          <div className={`grid gap-3 ${changes.length > 1 ? "sm:grid-cols-2" : ""}`}>
            {changes.map((c) => <Tile key={c.label} label={c.label} value={fmtSigned(c.value)} />)}
          </div>
        </Panel>
      </div>
    </>
  );
}
