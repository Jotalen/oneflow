"use client";
import { useState, type FormEvent } from "react";
import { useReadyBank, type TransferResult } from "@/components/nova/BankProvider";
import { fmtDate } from "@/components/nova/ui";
import { CARD_BILL_ID, defaultBillId, parseDollarInput, type BillOption } from "@/lib/bank/everyday";
import { fmtUSD, type Cents } from "@/lib/money";

type From = "checking" | "savings";
type Mode = "transfer" | "paybill";

const FIELD = "rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-fg";
const centsToInput = (c: Cents) => (c / 100).toFixed(2);

function ResultLine({ r }: { r: TransferResult }) {
  if (!r.ok) return <p role="alert" className="text-sm text-bad mt-2">Couldn&apos;t move money: {r.error ?? "unknown error"}</p>;
  return (
    <p role="status" className="text-sm text-good mt-2">
      Done{r.description ? ` — ${r.description}` : ""}.{r.simulated ? " Simulated (bank offline, nothing moved)." : " Balances refresh in a moment."}
    </p>
  );
}

const optionText = (o: BillOption) => `${o.label} · ${fmtUSD(o.amount)} · due ${fmtDate(o.date)}${o.payable ? "" : ` · ${o.reason}`}`;

function BillPicker({ options, value, onChange, cardBalance }: { options: BillOption[]; value: string; onChange: (id: string) => void; cardBalance: Cents }) {
  return (
    <label className="text-xs text-muted flex flex-col gap-1 min-w-0 w-full sm:w-auto">Bill
      <select className={`${FIELD} w-full sm:w-auto sm:max-w-md`} value={value} onChange={(e) => onChange(e.target.value)} required>
        {value === "" && <option value="" disabled>Choose a bill</option>}
        {options.map((o) => <option key={o.id} value={o.id} disabled={!o.payable}>{optionText(o)}</option>)}
      </select>
      {value === CARD_BILL_ID && <span>From checking · card balance {fmtUSD(cardBalance)}</span>}
    </label>
  );
}

/**
 * Inline form: checking↔savings transfer, or pay a bill from checking. Both call the real
 * /api/transfer route. Only bills that route can pay (the credit card) are selectable; the rest
 * are listed, disabled, with why (autopay or paid with the biller).
 */
export function MoveMoneyForm({ mode, onClose, cardBalance, bills = [] }: { mode: Mode; onClose: () => void; cardBalance: Cents; bills?: BillOption[] }) {
  const b = useReadyBank();
  const [from, setFrom] = useState<From>("checking");
  const [billId, setBillId] = useState(() => defaultBillId(bills));
  const [amount, setAmount] = useState(() => {
    const bill = bills.find((o) => o.id === billId);
    return mode === "paybill" && bill ? centsToInput(bill.amount) : "";
  });
  const [result, setResult] = useState<TransferResult | null>(null);
  if (!b) return null;
  const payable = bills.filter((o) => o.payable);

  if (mode === "paybill" && payable.length === 0) {
    return (
      <div className="mt-4 rounded-xl bg-surface-2 p-3 flex flex-wrap items-center justify-between gap-2" role="status">
        <div className="text-sm">
          <p className="font-semibold">No bills to pay at the moment.</p>
          {bills.length > 0 && <p className="text-xs text-muted mt-0.5">Your {bills.length === 1 ? "bill is" : `${bills.length} bills are`} on autopay or paid with the biller.</p>}
        </div>
        <button type="button" className="btn" onClick={onClose}>Close</button>
      </div>
    );
  }

  const pickBill = (id: string) => {
    setBillId(id);
    const bill = bills.find((o) => o.id === id);
    if (bill) setAmount(centsToInput(bill.amount));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cents = parseDollarInput(amount);
    if (mode === "paybill" && billId !== CARD_BILL_ID) { setResult({ ok: false, error: "Choose a bill to pay" }); return; }
    if (cents === null) { setResult({ ok: false, error: "Enter an amount greater than $0" }); return; }
    if (mode === "paybill") { setResult(await b.transfer("checking", "card", cents, "Card payment")); return; }
    const to = from === "checking" ? "savings" : "checking";
    setResult(await b.transfer(from, to, cents, `Move to ${to}`));
  };

  return (
    <form onSubmit={submit} className="mt-4 rounded-xl bg-surface-2 p-3" aria-label={mode === "paybill" ? "Pay a bill" : "Transfer money"}>
      <div className="flex flex-wrap items-end gap-2">
        {mode === "transfer" ? (
          <label className="text-xs text-muted flex flex-col gap-1">From
            <select className={FIELD} value={from} onChange={(e) => setFrom(e.target.value as From)}>
              <option value="checking">Checking → Savings</option>
              <option value="savings">Savings → Checking</option>
            </select>
          </label>
        ) : <BillPicker options={bills} value={billId} onChange={pickBill} cardBalance={cardBalance} />}
        <label className="text-xs text-muted flex flex-col gap-1">Amount ($)
          <input inputMode="decimal" className={`w-32 ${FIELD}`} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </label>
        <button type="submit" className="btn btn-primary" disabled={b.transferring}>{b.transferring ? "Moving…" : mode === "paybill" ? "Pay bill" : "Transfer"}</button>
        <button type="button" className="btn" onClick={onClose}>Close</button>
      </div>
      {result && <ResultLine r={result} />}
    </form>
  );
}
