"use client";

import { useEffect, useEffectEvent, useRef, useState, type FormEvent } from "react";
import { getBase64EncodedWireTransaction, getSignatureFromTransaction, isTransactionModifyingSigner, isTransactionPartialSigner, signTransactionMessageWithSigners } from "@solana/kit";
import { useClient } from "@solana/react";
import { Panel, Tile } from "@/components/nova/ui";
import type { SolanaClient } from "@/lib/solana/client";
import { formatTokenAmount, parseUsdcAmount } from "@/lib/solana/payment";
import { preparePayment, type PreparedPayment } from "@/lib/solana/prepare-payment";
import { mergeReceipt, readReceipts, receiptsKey, reconcileReceipt, RECEIPTS_EVENT, type StoredPayment } from "@/lib/solana/receipts";
import { BudgetPreview } from "./BudgetPreview";
import { ReceiptList } from "./ReceiptList";

type Busy = "preparing" | "signing" | "verifying" | null;
const inputClass = "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm";

export function PaymentForm({ owner, onVerified, onBusy }: { owner: string; onVerified: () => void; onBusy: (busy: boolean) => void }) {
  const client = useClient<SolanaClient>();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [review, setReview] = useState<PreparedPayment | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState(false);
  const [receipts, setReceipts] = useState<StoredPayment[]>(() => {
    try { return readReceipts(window.localStorage, owner); } catch { return []; }
  });
  const receiptRef = useRef(receipts);
  const pendingPayment = receipts.find((receipt) => receipt.status === "pending");
  const pending = !!pendingPayment;
  const editingLocked = busy === "preparing" || busy === "signing";

  function start(stage: Exclude<Busy, null>) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(stage);
    onBusy(true);
    setError(null);
    return true;
  }
  function finish() { lock.current = false; setBusy(null); onBusy(false); }
  function save(payment: StoredPayment) {
    const next = mergeReceipt(receiptRef.current, payment);
    receiptRef.current = next;
    setReceipts(next);
    try { window.localStorage.setItem(receiptsKey(owner), JSON.stringify(next)); }
    catch { setStorageError(true); }
    window.dispatchEvent(new Event(RECEIPTS_EVENT));
  }

  async function prepare(event: FormEvent) {
    event.preventDefault();
    if (pending || !start("preparing")) return;
    try {
      const connected = client.wallet.getState().connected;
      if (!connected?.signer || connected.account.address !== owner) throw new Error("Connect your sending wallet first.");
      if (!connected.supportedTransactionVersions.has(0) || (!isTransactionModifyingSigner(connected.signer) && !isTransactionPartialSigner(connected.signer))) throw new Error("This wallet cannot sign the payment format. Use the Phantom browser extension.");
      const prepared = await preparePayment(client, connected.signer, { sender: owner, recipient: recipient.trim(), amount: parseUsdcAmount(amount).toString() });
      if (client.wallet.getState().connected?.account.address !== owner) throw new Error("Your wallet changed. Review again with the connected account.");
      setReview(prepared);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not prepare the payment."); }
    finally { finish(); }
  }

  async function verify(payment: StoredPayment, attempts = 1, submittedAt?: number) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      const response = await fetch("/api/solana/verify", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ sender: payment.sender, recipient: payment.recipient, amount: payment.amount, signature: payment.signature, lastValidBlockHeight: payment.lastValidBlockHeight }),
        signal: AbortSignal.timeout(20_000),
      });
      const next = reconcileReceipt(payment, await response.json());
      if (next.status !== "pending") {
        save(next.status === "verified" ? { ...next, verifiedAt: new Date().toISOString(), verificationMs: submittedAt === undefined ? next.verificationMs : Math.max(0, Math.round(performance.now() - submittedAt)) } : next);
        if (next.status === "verified") onVerified();
        return;
      }
      if (response.status !== 202 || attempt === attempts - 1) throw new Error(next.error || "Payment verification is still pending. Check its status before sending again.");
      await new Promise((resolve) => setTimeout(resolve, 1_500));
    }
  }

  async function send() {
    if (!review || pending || !start("signing")) return;
    let submitted: StoredPayment | null = null;
    try {
      const height = await client.rpc.getBlockHeight({ commitment: "confirmed" }).send({ abortSignal: AbortSignal.timeout(12_000) });
      if (height > BigInt(review.lastValidBlockHeight)) { setReview(null); throw new Error("The fee quote expired. Review the payment again."); }
      if (client.wallet.getState().connected?.account.address !== owner) throw new Error("Your wallet changed. Review the payment again.");
      const signed = await signTransactionMessageWithSigners(review.message);
      if (signed.messageBytes.length !== review.messageBytes.length || signed.messageBytes.some((byte, index) => byte !== review.messageBytes[index])) throw new Error("The wallet changed the reviewed transaction. Nothing was sent; review again.");
      if (client.wallet.getState().connected?.account.address !== owner) throw new Error("Your wallet changed while signing. Nothing was sent.");
      submitted = { ...review.request, signature: getSignatureFromTransaction(signed), lastValidBlockHeight: review.lastValidBlockHeight, status: "pending", createdAt: new Date().toISOString() };
      // Keep the signature before broadcast so a timeout never invites a duplicate send.
      save(submitted);
      setReview(null);
      setBusy("verifying");
      const submittedAt = performance.now();
      try {
        await client.rpc.sendTransaction(getBase64EncodedWireTransaction(signed), { encoding: "base64", preflightCommitment: "confirmed", skipPreflight: false, maxRetries: BigInt(3) }).send({ abortSignal: AbortSignal.timeout(20_000) });
      } catch {
        // A transport timeout can happen after submission; resolve the same signature.
      }
      await verify(submitted, 6, submittedAt);
      setAmount("");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not complete the payment request.";
      if (submitted) {
        save({ ...submitted, error: message });
        setError(`${message} Use Check status below to resolve this signature; do not send the payment again.`);
      } else {
        setError(message);
      }
    } finally { finish(); }
  }

  async function check(payment: StoredPayment) {
    if (!start("verifying")) return;
    try { await verify(payment); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not check the transaction. Keep its Explorer link and try again."); }
    finally { finish(); }
  }

  const resumePending = useEffectEvent(async () => {
    for (const payment of receiptRef.current.filter((receipt) => receipt.status === "pending")) {
      await check(payment);
    }
  });

  useEffect(() => {
    // Cancel the queued read on unmount (including Strict Mode's initial replay).
    // This only verifies saved signatures; it never signs or broadcasts a payment.
    const timer = window.setTimeout(() => { void resumePending(); }, 0);
    return () => window.clearTimeout(timer);
  }, [owner]);

  return (
    <>
      <Panel title="Send test USDC" subtitle="Review here, then approve the exact transaction in your wallet.">
        {review ? (
          <div className="space-y-4">
            <dl className="space-y-2 text-sm">
              <div><dt className="text-muted">From</dt><dd className="break-all font-mono text-xs">{review.request.sender}</dd></div>
              <div><dt className="text-muted">To</dt><dd className="break-all font-mono text-xs">{review.request.recipient}</dd></div>
            </dl>
            <div className="grid gap-3 sm:grid-cols-2">
              <Tile label="Recipient receives" value={`${formatTokenAmount(review.request.amount)} USDC`} note="Solana Devnet" />
              <Tile label="Wallet USDC after payment" value={formatTokenAmount(review.remainingUsdc)} />
              <Tile label="Network fee" value={`${formatTokenAmount(review.networkFee, 9)} SOL`} />
              <Tile label="Recipient token account" value={`${formatTokenAmount(review.rent, 9)} SOL`} note={review.createsAccount ? "One-time account creation, paid by you" : "Already exists · no creation cost"} />
            </div>
            <p className="text-sm text-muted">Total SOL cost: <strong>{formatTokenAmount(review.networkFee + review.rent, 9)} SOL</strong>. This quote expires shortly; Phantom must approve before anything is sent.</p>
            <BudgetPreview amount={review.request.amount} />
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" disabled={!!busy} onClick={() => void send()}>{busy === "signing" ? "Approve in Phantom…" : busy === "verifying" ? "Verifying payment…" : "Approve in wallet"}</button>
              <button className="btn" disabled={!!busy} onClick={() => { setReview(null); setError(null); }}>Edit payment</button>
            </div>
          </div>
        ) : (
          <form onSubmit={(event) => void prepare(event)} className="space-y-3">
            <label className="block text-sm font-medium" htmlFor="solana-recipient">Recipient wallet address
              <input id="solana-recipient" autoComplete="off" spellCheck={false} maxLength={44} className={`${inputClass} mt-1 font-mono`} value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="Paste a Solana wallet address" disabled={editingLocked} required />
            </label>
            <label className="block text-sm font-medium" htmlFor="solana-amount">Amount in test USDC
              <input id="solana-amount" inputMode="decimal" autoComplete="off" maxLength={21} className={`${inputClass} mt-1`} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="1.00" disabled={editingLocked} required />
            </label>
            <button className="btn btn-primary" disabled={!!busy || pending}>{busy === "preparing" ? "Checking balances and fees…" : busy === "verifying" ? "Verifying payment…" : "Review payment"}</button>
            {pendingPayment && <div className="space-y-2">
              <p className="text-sm text-muted" role="status">{busy === "verifying" ? "Checking your previous payment…" : "You can fill out a new payment. Verify the previous payment before reviewing or sending another."}</p>
              <button type="button" className="btn text-sm" disabled={!!busy} onClick={() => void check(pendingPayment)}>Check previous payment</button>
            </div>}
          </form>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-bad">{error}</p>}
        <p className="mt-4 text-xs text-muted">Test tokens only. This wallet payment does not debit your OneFlow bank accounts.</p>
      </Panel>
      <Panel title="Payment receipts" subtitle="Devnet payments made from this wallet in this browser.">
        {receipts.length === 0 ? <p className="text-sm text-muted">Your first payment receipt will appear here.</p> : <ReceiptList receipts={receipts} busy={!!busy} onCheck={(payment) => void check(payment)} />}
        {storageError && <p role="alert" className="mt-3 text-xs text-bad">This browser could not save receipts. Keep the Explorer link for your transaction before closing this page.</p>}
      </Panel>
    </>
  );
}
