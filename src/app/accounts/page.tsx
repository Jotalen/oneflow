"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHeader, Panel, Tile, fmtSigned, initials } from "@/components/nova/ui";
import { Loading } from "@/components/nova/Loading";
import { useReadyBank } from "@/components/nova/BankProvider";
import { BalanceHistory } from "@/components/nova/BalanceHistory";
import type { BankAccount, Profile } from "@/lib/engine/types";
import { fmtUSD, type Cents } from "@/lib/money";

const TITLE = "Accounts";
const SUBTITLE = "Every account you have with OneFlow, in one place.";
const PCT = 100;

interface AcctRow { id: string; title: string; sub: string; value: Cents; href: string }

const CASH_HREF: Record<string, string> = { checking: "/day-to-day", savings: "/goals", cd: "/safety-net" };
const CASH_SUB: Record<string, string> = { checking: "Day-to-day spending", savings: "Savings · goals live inside", cd: "Certificate of deposit" };

const cashRows = (p: Profile): AcctRow[] =>
  p.accounts.filter((a) => a.kind !== "card").map((a) => ({ id: a.id, title: a.nickname, sub: CASH_SUB[a.kind] ?? a.kind, value: a.balance, href: CASH_HREF[a.kind] ?? "/day-to-day" }));

const cardSub = (a: BankAccount) => {
  const limit = a.creditLimit ?? 0;
  if (!limit) return "Credit card";
  return `${fmtUSD(Math.max(0, limit - a.balance))} available of ${fmtUSD(limit)} · ${Math.round((a.balance / limit) * PCT)}% used`;
};
const cardRows = (p: Profile): AcctRow[] =>
  p.accounts.filter((a) => a.kind === "card").map((a) => ({ id: a.id, title: a.nickname, sub: cardSub(a), value: -a.balance, href: "/debt" }));

function loanRows(p: Profile): AcctRow[] {
  const rows: AcctRow[] = [];
  const c = p.contract;
  if (c) {
    const car = p.car ? `${p.car.year} ${p.car.model}` : "Toyota";
    rows.push(c.type === "lease"
      ? { id: "contract", title: `${car} lease`, sub: `Toyota Financial Services · ${c.monthsRemaining} payments left · remaining lease payments`, value: -c.balance, href: "/car" }
      : { id: "contract", title: `${car} auto loan`, sub: `Toyota Financial Services · ${c.monthsRemaining} payments left`, value: -c.balance, href: "/car" });
  }
  p.debts.filter((d) => d.kind === "other" && d.balance > 0).forEach((d) => rows.push({ id: d.id, title: d.label, sub: `${d.aprPct}% APR`, value: -d.balance, href: "/debt" }));
  return rows;
}

const sum = (rows: AcctRow[]) => rows.reduce((s, r) => s + r.value, 0);

function Group({ title, rows, empty }: { title: string; rows: AcctRow[]; empty: string }) {
  return (
    <Panel title={title} right={<span className="font-semibold money">{fmtSigned(sum(rows)).replace("+", "")}</span>}>
      {rows.length === 0 ? <p className="text-sm text-muted">{empty}</p> : (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={r.href} className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg hover:bg-surface-2">
                <span className="h-9 w-9 shrink-0 rounded-lg bg-surface-2 border border-line grid place-items-center text-xs font-semibold text-muted" aria-hidden>{initials(r.title)}</span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold truncate">{r.title}</span><span className="block text-xs text-muted truncate">{r.sub}</span></span>
                <span className="text-sm font-semibold money shrink-0">{fmtSigned(r.value).replace("+", "")}</span>
                <span className="text-muted" aria-hidden>›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export default function AccountsPage() {
  const b = useReadyBank();
  const view = b?.view;
  const [refreshing, setRefreshing] = useState(false);
  // A new view object means fresh data arrived; stamp the local time it was received.
  const syncedAt = useMemo(() => (view ? new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""), [view]);
  if (!b) return <><PageHeader title={TITLE} subtitle={SUBTITLE} /><Loading /></>;
  const p = b.analysis.profile;
  const cash = cashRows(p), cards = cardRows(p), loans = loanRows(p);
  const count = cash.length + cards.length + loans.length;
  const onRefresh = async () => { setRefreshing(true); try { await b.refresh(); } finally { setRefreshing(false); } };

  return (
    <>
      <PageHeader title={TITLE} subtitle={SUBTITLE} />
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 mb-4">
        <Tile label="Cash" value={fmtUSD(sum(cash))} />
        <Tile label="Credit cards" value={fmtSigned(sum(cards)).replace("+", "")} />
        <Tile label="Loans" value={fmtSigned(sum(loans)).replace("+", "")} note={p.contract?.type === "lease" ? "Includes remaining lease payments" : undefined} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Group title="Cash" rows={cash} empty="No deposit accounts." />
        <Group title="Credit cards" rows={cards} empty="No credit cards." />
        <Group title="Loans" rows={loans} empty="No loans or leases." />
      </div>
      {b.live && <div className="mt-4"><BalanceHistory personaId={b.personaId} /></div>}
      <div className="flex flex-wrap items-center gap-3 mt-4 text-sm text-muted">
        <span>{count} accounts · {b.live ? "live from the bank" : "offline snapshot"}{syncedAt ? ` · last synced ${syncedAt}` : ""}</span>
        <button className="btn" onClick={() => void onRefresh()} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh"}</button>
      </div>
    </>
  );
}
