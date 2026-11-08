"use client";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader, Panel, Row, fmtDate, fmtSigned, initials } from "@/components/nova/ui";
import { Loading } from "@/components/nova/Loading";
import { useReadyBank } from "@/components/nova/BankProvider";
import { useStored } from "@/components/nova/everyday/useStored";
import { TxnDetail } from "@/components/nova/everyday/TxnDetail";
import { WalletLoader } from "@/components/solana/WalletLoader";
import { CATEGORY_LABEL, addDays, type Category, type LedgerTxn } from "@/lib/bank/view";
import { AS_OF } from "@/lib/engine/types";
import {
  AMOUNT_FILTERS, applyBudgetOverrides, categoryOf, filterLedger, groupByDay, ledgerCsv,
  type AmountFilter, type BudgetOverrides, type TxnMeta, type TxnMetaMap,
} from "@/lib/bank/everyday";

const TITLE = "Transactions";
const SUBTITLE = "Search and filter every purchase, deposit and transfer.";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SELECT = "rounded-full border border-line bg-surface px-3 py-2 text-sm";

function dayLabel(iso: string): string {
  const wd = WEEKDAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()];
  const base = `${wd}, ${fmtDate(iso)}`;
  if (iso === AS_OF) return `Today · ${base}`;
  if (iso === addDays(AS_OF, -1)) return `Yesterday · ${base}`;
  return base;
}

function downloadCsv(csv: string, name: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function TransactionsInner({ initialQ }: { initialQ: string }) {
  const b = useReadyBank();
  const [q, setQ] = useState(initialQ);
  const [accountId, setAccountId] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [amount, setAmount] = useState<AmountFilter>("any");
  const [selected, setSelected] = useState<string | null>(null);
  const personaId = b?.personaId ?? "";
  const [meta, setMeta] = useStored<TxnMetaMap>("txmeta", personaId, {});
  const [overrides] = useStored<BudgetOverrides>("budget", personaId, {});
  const ledger = b?.view.ledger;
  const rows = useMemo(() => (ledger ? filterLedger(ledger, { q, accountId: accountId || undefined, category: category || undefined, amount }, meta) : []), [ledger, q, accountId, category, amount, meta]);

  if (!b) return <><PageHeader title={TITLE} subtitle={SUBTITLE} /><Loading /></>;
  const { analysis, view } = b;
  const budget = applyBudgetOverrides(view.budget, overrides);
  const current: LedgerTxn | undefined = rows.find((t) => t.id === selected) ?? rows[0];
  const update = (id: string, patch: TxnMeta) => setMeta({ ...meta, [id]: { ...meta[id], ...patch } });
  const usedCats = Array.from(new Set(view.ledger.map((t) => categoryOf(t, meta))));
  const detail = current ? <TxnDetail txn={current} meta={meta} budget={budget} onChange={update} /> : null;

  return (
    <>
      <PageHeader title={TITLE} subtitle={SUBTITLE}
        actions={<button className="btn" disabled={rows.length === 0} onClick={() => downloadCsv(ledgerCsv(rows, meta), `transactions-${personaId}-${AS_OF}.csv`)}>Export CSV</button>} />
      <div className="mb-4"><WalletLoader mode="activity" /></div>
      <div className="flex flex-wrap gap-2 mb-4">
        <input type="search" aria-label="Search transactions" placeholder="Search merchants, categories or amounts" value={q} onChange={(e) => setQ(e.target.value)}
          className="flex-1 min-w-[12rem] rounded-full border border-line bg-surface px-4 py-2 text-sm" />
        <select aria-label="Account" className={SELECT} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">All accounts</option>
          {analysis.profile.accounts.map((a) => <option key={a.id} value={a.id}>{a.nickname}</option>)}
        </select>
        <select aria-label="Category" className={SELECT} value={category} onChange={(e) => setCategory(e.target.value as Category | "")}>
          <option value="">All categories</option>
          {usedCats.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </select>
        <select aria-label="Amount" className={SELECT} value={amount} onChange={(e) => setAmount(e.target.value as AmountFilter)}>
          {AMOUNT_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr] items-start">
        <Panel subtitle={`${rows.length} of ${view.ledger.length} transactions · last 8 weeks`}>
          {rows.length === 0 ? <p className="text-sm text-muted py-6 text-center">No transactions match.</p> : groupByDay(rows).map((g) => (
            <div key={g.date} className="mb-2">
              <h3 className="text-xs font-semibold text-muted pt-2 pb-1">{dayLabel(g.date)}</h3>
              {g.txns.map((t) => (
                <div key={t.id}>
                  <Row icon={initials(t.merchant)} title={t.merchant} sub={`${CATEGORY_LABEL[categoryOf(t, meta)]} · ${t.accountLabel}${meta[t.id]?.note ? " · note" : ""}`}
                    value={fmtSigned(t.amount)} active={current?.id === t.id} onClick={() => setSelected(t.id)} />
                  {current?.id === t.id && selected === t.id && <div className="lg:hidden rounded-xl border border-line p-3 my-2">{detail}</div>}
                </div>
              ))}
            </div>
          ))}
        </Panel>
        <div className="hidden lg:block lg:sticky lg:top-5">{detail && <Panel>{detail}</Panel>}</div>
      </div>
    </>
  );
}

/** Remount when the header search pushes a new ?q= so the box reflects it. */
function FromUrl() {
  const q = useSearchParams().get("q") ?? "";
  return <TransactionsInner key={q} initialQ={q} />;
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<><PageHeader title={TITLE} subtitle={SUBTITLE} /><Loading /></>}>
      <FromUrl />
    </Suspense>
  );
}
