"use client";
import { useState, type FormEvent } from "react";
import { useReadyBank, type TransferResult } from "@/components/nova/BankProvider";
import { parseDollarInput } from "@/lib/bank/everyday";
import { fmtUSD, type Cents } from "@/lib/money";

type From = "checking" | "savings";
type Mode = "transfer" | "paycard";

const LABEL: Record<From | "card", string> = { checking: "Checking", savings: "Savings", card: "Credit card" };

function ResultLine({ r }: { r: TransferResult }) {
  if (!r.ok) return <p role="alert" className="text-sm text-bad mt-2">Couldn&apos;t move money: {r.error ?? "unknown error"}</p>;
  return (
    <p role="status" className="text-sm text-good mt-2">
      Done{r.description ? ` — ${r.description}` : ""}.{r.simulated ? " Simulated (bank offline, nothing moved)." : " Balances refresh in a moment."}
    </p>
  );
}

/** Inline form: checking↔savings transfer, or pay the credit card from checking. Real /api/transfer call. */
export function MoveMoneyForm({ mode, onClose, cardBalance, minDue }: { mode: Mode; onClose: () => void; cardBalance: Cents; minDue?: Cents }) {
  const b = useReadyBank();
  const [from, setFrom] = useState<From>("checking");
  const [amount, setAmount] = useState(mode === "paycard" && minDue ? (minDue / 100).toFixed(2) : "");
  const [result, setResult] = useState<TransferResult | null>(null);
  if (!b) return null;
  const to = mode === "paycard" ? "card" : from === "checking" ? "savings" : "checking";
  const cents = parseDollarInput(amount);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (cents === null) { setResult({ ok: false, error: "Enter an amount greater than $0" }); return; }
    setResult(await b.transfer(mode === "paycard" ? "checking" : from, to, cents, mode === "paycard" ? "Card payment" : `Move to ${to}`));
  };

  return (
    <form onSubmit={submit} className="mt-4 rounded-xl bg-surface-2 p-3" aria-label={mode === "paycard" ? "Pay credit card" : "Transfer money"}>
      <div className="flex flex-wrap items-end gap-2">
        {mode === "transfer" ? (
          <label className="text-xs text-muted flex flex-col gap-1">From
            <select className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-fg" value={from} onChange={(e) => setFrom(e.target.value as From)}>
              <option value="checking">Checking → Savings</option>
              <option value="savings">Savings → Checking</option>
            </select>
          </label>
        ) : (
          <div className="text-sm"><span className="text-muted">Checking → </span>{LABEL.card} <span className="text-muted">· balance {fmtUSD(cardBalance)}</span></div>
        )}
        <label className="text-xs text-muted flex flex-col gap-1">Amount ($)
          <input inputMode="decimal" className="w-32 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-fg" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </label>
        <button type="submit" className="btn btn-primary" disabled={b.transferring}>{b.transferring ? "Moving…" : mode === "paycard" ? "Pay card" : "Transfer"}</button>
        <button type="button" className="btn" onClick={onClose}>Close</button>
      </div>
      {result && <ResultLine r={result} />}
    </form>
  );
}
