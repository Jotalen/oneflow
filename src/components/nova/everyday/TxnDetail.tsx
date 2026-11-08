"use client";
import { fmtDate, fmtSigned, initials } from "@/components/nova/ui";
import type { Budget, Category, LedgerTxn } from "@/lib/bank/view";
import { CategoryOptions } from "@/components/nova/everyday/CategoryOptions";
import { categoryOf, pointsForTxn, type TxnMeta, type TxnMetaMap } from "@/lib/bank/everyday";
import { fmtUSD } from "@/lib/money";

function budgetLine(budget: Budget, cat: Category): string {
  const c = budget.categories.find((x) => x.key === cat);
  return c ? `${c.label} · ${fmtUSD(c.spent)} of ${fmtUSD(c.limit)}` : "Not in your budget";
}

/** Detail for one transaction: account, points, budget status, editable category + note (saved locally). */
export function TxnDetail({ txn, meta, budget, onChange }: { txn: LedgerTxn; meta: TxnMetaMap; budget: Budget; onChange: (id: string, patch: TxnMeta) => void }) {
  const cat = categoryOf(txn, meta);
  const points = pointsForTxn({ ...txn, category: cat });
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-surface-2 border border-line grid place-items-center text-xs font-semibold text-muted" aria-hidden>{initials(txn.merchant)}</div>
        <div className="min-w-0"><div className="font-semibold truncate">{txn.merchant}</div><div className="text-xs text-muted">{fmtDate(txn.date, true)} · {txn.status === "completed" ? "Posted" : txn.status}</div></div>
      </div>
      <div className="text-3xl font-semibold money mt-3">{fmtSigned(txn.amount)}</div>
      <dl className="grid grid-cols-[6rem_1fr] gap-y-1.5 text-sm mt-3">
        <dt className="text-muted">Account</dt><dd>{txn.accountLabel}</dd>
        {txn.accountKind === "card" && <><dt className="text-muted">Points earned</dt><dd className="font-semibold">+{points} pts</dd></>}
        {txn.amount < 0 && <><dt className="text-muted">Budget</dt><dd>{budgetLine(budget, cat)}</dd></>}
      </dl>
      <label className="block text-sm font-semibold mt-4">Category
        <select name="category" className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-2 text-sm font-normal" value={cat}
          onChange={(e) => onChange(txn.id, { category: e.target.value as Category })}>
          <CategoryOptions />
        </select>
      </label>
      <label className="block text-sm font-semibold mt-3">Note
        <textarea name="note" className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-2 text-sm font-normal" rows={3} placeholder="Add a note"
          value={meta[txn.id]?.note ?? ""} onChange={(e) => onChange(txn.id, { note: e.target.value })} />
      </label>
      <p className="text-[0.7rem] text-muted mt-1">Category and note are saved on this device only.</p>
    </div>
  );
}
