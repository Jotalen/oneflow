"use client";
import { useRef, useState, type FormEvent, type MouseEvent } from "react";
import { usePersona } from "@/components/PersonaProvider";
import { useReadyBank } from "@/components/nova/BankProvider";
import { parseDollarInput } from "@/lib/bank/everyday";
import { MAX_MEMO_CHARS, MAX_P2P_CENTS, recipientsFor, type P2PReceipt, type P2PResult } from "@/lib/bank/p2p";
import { fmtUSD } from "@/lib/money";
import { showModalFrom } from "../motion/dialogOrigin";

const REFRESH_AFTER_SEND_MS = 1_500;
const FIELD = "rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-fg";

async function postP2P(body: { persona: string; to: string; amountCents: number; memo?: string }): Promise<P2PResult> {
  try {
    const res = await fetch("/api/p2p", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return (await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))) as P2PResult;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network error" };
  }
}

function Receipt({ r }: { r: P2PReceipt }) {
  const done = r.status === "completed";
  return (
    <div role="status" className="rounded-xl bg-surface-2 p-3 text-sm space-y-1">
      <div className="font-semibold">{done ? "Sent" : "Sending"} {fmtUSD(r.amountCents)} to {r.recipient.name}</div>
      {r.memo && <div className="text-muted">“{r.memo}”</div>}
      <div className="text-muted">
        {done ? "The bank completed the transfer." : `Status: ${r.status}. It settles on its own within about a minute; the bell shows it when it does.`}
      </div>
      <div className="text-xs text-muted break-all">Nessie transaction {r.txId}</div>
    </div>
  );
}

/** "Send money" button + modal: a real P2P transfer to another OneFlow customer's checking. */
export function SendMoneyDialog({ availableCents }: { availableCents: number }) {
  const b = useReadyBank();
  const { personas } = usePersona();
  const ref = useRef<HTMLDialogElement>(null);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<P2PResult | null>(null);
  const [reviewing, setReviewing] = useState(false); // real money: a second, explicit confirm before sending
  if (!b) return null;
  const people = recipientsFor(personas, b.personaId);
  const toName = people.find((p) => p.id === to)?.name ?? "";
  const edit = (set: (v: string) => void) => (v: string) => { set(v); setReviewing(false); };

  const open = (e: MouseEvent<HTMLButtonElement>) => { setResult(null); setReviewing(false); showModalFrom(ref.current, e.currentTarget); };
  const close = () => ref.current?.close();
  const reset = () => { setResult(null); setReviewing(false); setAmount(""); setMemo(""); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cents = parseDollarInput(amount);
    if (!to) return setResult({ ok: false, error: "Choose who to pay" });
    if (cents === null) return setResult({ ok: false, error: "Enter an amount greater than $0" });
    if (cents > MAX_P2P_CENTS) return setResult({ ok: false, error: `At most ${fmtUSD(MAX_P2P_CENTS)} per send` });
    if (cents > availableCents) return setResult({ ok: false, error: `Only ${fmtUSD(availableCents)} available in checking` });
    if (!reviewing) { setResult(null); setReviewing(true); return; }
    setSending(true);
    const r = await postP2P({ persona: b.personaId, to, amountCents: cents, memo: memo.trim() || undefined });
    setSending(false);
    setResult(r);
    if (r.ok) setTimeout(() => void b.refresh(), REFRESH_AFTER_SEND_MS);
  };

  return (
    <>
      <button className="btn" onClick={open} aria-haspopup="dialog">Send money</button>
      <dialog ref={ref} aria-labelledby="send-money-title" className="panel dialog-pop m-auto w-[min(26rem,calc(100vw-2rem))] p-5 text-fg backdrop:bg-black/40">
        <h2 id="send-money-title" className="font-semibold text-lg">Send money</h2>
        <p className="text-xs text-muted mt-0.5">From checking to another OneFlow customer. Moves real money in the bank.</p>
        {result?.ok ? (
          <div className="mt-4 space-y-3">
            <Receipt r={result} />
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn" onClick={reset}>Send another</button>
              <button type="button" className="btn btn-primary" onClick={close}>Done</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <label className="text-xs text-muted flex flex-col gap-1">To
              <select name="to" className={FIELD} value={to} onChange={(e) => edit(setTo)(e.target.value)} required>
                <option value="">Choose a person</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-muted flex flex-col gap-1">Amount ($) · {fmtUSD(availableCents)} available
              <input name="amount" inputMode="decimal" className={FIELD} value={amount} onChange={(e) => edit(setAmount)(e.target.value)} placeholder="0.00" required />
            </label>
            <label className="text-xs text-muted flex flex-col gap-1">Memo (optional)
              <input name="memo" className={FIELD} value={memo} maxLength={MAX_MEMO_CHARS} onChange={(e) => edit(setMemo)(e.target.value)} placeholder="What's it for?" />
            </label>
            {reviewing && <p role="status" className="rounded-xl bg-surface-2 p-3 text-sm">Send <span className="font-semibold money">{amount && fmtUSD(parseDollarInput(amount) ?? 0)}</span> to <span className="font-semibold">{toName}</span> from checking? This can&apos;t be undone.</p>}
            {result && !result.ok && <p role="alert" className="text-sm text-bad">Couldn&apos;t send: {result.error}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn" onClick={reviewing ? () => setReviewing(false) : close}>{reviewing ? "Back" : "Cancel"}</button>
              <button type="submit" className="btn btn-primary" disabled={sending}>{sending ? "Sending…" : reviewing ? "Confirm send" : "Review"}</button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
