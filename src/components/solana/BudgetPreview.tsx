"use client";

import { useState } from "react";
import { useBank } from "@/components/nova/BankProvider";
import { useStored } from "@/components/nova/everyday/useStored";
import { Tile, fmtSigned } from "@/components/nova/ui";
import { applyBudgetOverrides, type BudgetOverrides } from "@/lib/bank/everyday";
import { previewPaymentBudget } from "@/lib/solana/budget";
import { formatTokenAmount } from "@/lib/solana/payment";
import { fmtUSD } from "@/lib/money";

const EMPTY: BudgetOverrides = {};

export function BudgetPreview({ amount }: { amount: string }) {
  const bank = useBank();
  const [overrides] = useStored<BudgetOverrides>("budget", bank.personaId, EMPTY);
  const [chosen, setChosen] = useState("");
  if (!bank.view) return <p className="text-xs text-muted">Demo budget comparison will appear when the bank profile finishes loading.</p>;
  const budget = applyBudgetOverrides(bank.view.budget, overrides);
  const categories = budget.categories.filter((item) => !item.fixed);
  const category = categories.find((item) => item.key === chosen)?.key ?? categories.find((item) => item.key === "shopping")?.key ?? categories[0]?.key;
  const preview = category ? previewPaymentBudget(budget, category, BigInt(amount)) : null;
  if (!preview) return null;
  return (
    <section className="rounded-xl border border-line p-3 space-y-3" aria-label="Demo budget comparison">
      <div>
        <h3 className="text-sm font-semibold">Before you pay: demo budget impact</h3>
        <p className="text-xs text-muted mt-1">Compare {formatTokenAmount(amount)} test USDC as ${formatTokenAmount(amount)} of spending for {bank.persona?.name ?? bank.personaId}&apos;s synthetic profile.</p>
      </div>
      <label className="block text-xs font-medium" htmlFor="solana-budget-category">Compare with category
        <select id="solana-budget-category" className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm" value={category} onChange={(event) => setChosen(event.target.value)}>
          {categories.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select>
      </label>
      <div className="grid gap-2 sm:grid-cols-2" aria-live="polite">
        <Tile label={`${preview.category}: remaining now`} value={fmtSigned(preview.before).replace("+", "")} />
        <Tile label="Remaining if spent" value={fmtSigned(preview.after).replace("+", "")} />
      </div>
      <p className={`text-xs ${preview.overBy ? "text-bad" : "text-muted"}`} role="status">{preview.overBy ? `This would exceed the demo category budget by ${fmtUSD(preview.overBy)}.` : "This amount fits within the demo category budget."}</p>
      <p className="text-xs text-muted">Illustration only. Test USDC has no monetary value. Sending does not debit bank accounts or change the demo budget. Amounts below one cent are rounded up for this comparison.</p>
    </section>
  );
}
