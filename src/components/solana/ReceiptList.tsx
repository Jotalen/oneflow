"use client";

import { formatTokenAmount, transactionUrl } from "@/lib/solana/payment";
import type { StoredPayment } from "@/lib/solana/receipts";

export function ReceiptList({ receipts, busy, onCheck }: { receipts: StoredPayment[]; busy?: boolean; onCheck?: (payment: StoredPayment) => void }) {
  return (
    <ul className="divide-y divide-line min-w-0">
      {receipts.map((payment) => (
        <li key={payment.signature} className="py-3 space-y-2 min-w-0">
          <div className="flex flex-wrap justify-between gap-2 text-sm font-semibold"><span className="break-all">−{formatTokenAmount(payment.amount)} test USDC</span><span>{payment.status === "verified" ? "Verified on Devnet" : payment.status === "failed" ? "Not completed" : "Awaiting verification"}</span></div>
          <p className="text-xs text-muted break-all">To {payment.recipient}</p>
          <p className="text-xs text-muted">{new Date(payment.createdAt).toLocaleString()} · Solana Devnet</p>
          {payment.receipt && <p className="text-xs text-muted">Network fee: {formatTokenAmount(payment.receipt.networkFee, 9)} SOL · slot {payment.receipt.slot}</p>}
          {payment.verificationMs !== undefined && <p className="text-xs text-muted">Submission → verified receipt: {(payment.verificationMs / 1_000).toFixed(2)} s · measured in this browser, including verification requests</p>}
          {payment.error && <p className="text-xs text-bad break-words">{payment.error}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <a className="text-xs underline" href={transactionUrl(payment.signature)} target="_blank" rel="noreferrer">View transaction on Explorer</a>
            {payment.status === "pending" && (onCheck ? <button className="btn text-xs" disabled={busy} onClick={() => onCheck(payment)}>Check status</button> : <a className="text-xs underline" href="/solana">Resolve pending payment</a>)}
          </div>
        </li>
      ))}
    </ul>
  );
}
