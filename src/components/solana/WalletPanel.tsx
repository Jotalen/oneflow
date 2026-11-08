"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { address } from "@solana/kit";
import { ClientProvider, useClient, useRequest } from "@solana/react";
import { useConnect, useConnectedWallet, useDisconnect, useWallets, useWalletStatus } from "@solana/kit-plugin-wallet/react";
import { Panel, Tile } from "@/components/nova/ui";
import { client, DEVNET_USDC_MINT, type SolanaClient } from "@/lib/solana/client";
import { formatTokenAmount } from "@/lib/solana/payment";
import { PaymentForm } from "./PaymentForm";
import { WalletActivity } from "./WalletActivity";

function Balances({ owner }: { owner: string }) {
  const rpc = useClient<SolanaClient>().rpc;
  const solSource = useMemo(() => rpc.getBalance(address(owner), { commitment: "confirmed" }), [rpc, owner]);
  const usdcSource = useMemo(() => rpc.getTokenAccountsByOwner(
    address(owner), { mint: address(DEVNET_USDC_MINT) }, { encoding: "jsonParsed", commitment: "confirmed" },
  ), [rpc, owner]);
  const sol = useRequest(solSource);
  const usdc = useRequest(usdcSource);
  const usdcTotal = usdc.data?.value.reduce((total, entry) => total + BigInt(entry.account.data.parsed.info.tokenAmount.amount), BigInt(0));
  const loading = sol.status === "fetching" || usdc.status === "fetching";

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2" aria-live="polite">
        <Tile label="Test SOL" value={sol.status === "error" ? "Unavailable" : sol.data ? formatTokenAmount(sol.data.value, 9) : "Loading…"} note="Used for network fees" />
        <Tile label="Test USDC" value={usdc.status === "error" ? "Unavailable" : usdcTotal !== undefined ? formatTokenAmount(usdcTotal, 6) : "Loading…"} note="Devnet tokens · no monetary value" />
      </div>
      {Boolean(sol.error || usdc.error) && <p role="alert" className="text-sm text-bad">Could not load all balances from Devnet. Try refreshing. If this persists, use a dedicated Devnet RPC endpoint.</p>}
      <button className="btn" disabled={loading} onClick={() => { sol.refresh(); usdc.refresh(); }}>{loading ? "Refreshing…" : "Refresh balances"}</button>
    </div>
  );
}

function Connection({ payments }: { payments: boolean }) {
  const solana = useClient<SolanaClient>();
  const status = useWalletStatus(solana);
  const wallets = useWallets(solana);
  const connected = useConnectedWallet(solana);
  const connect = useConnect(solana);
  const disconnect = useDisconnect(solana);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [balanceRevision, setBalanceRevision] = useState(0);
  const busy = paymentBusy || connect.isRunning || disconnect.isRunning || status === "pending" || status === "reconnecting";

  // Outside /solana, an unconnected wallet gets one line, not the full setup guide.
  if (!payments && !connected && !busy) {
    return (
      <Panel title="Solana wallet" right={<span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold">Solana Devnet</span>}>
        <p className="text-sm text-muted">Pay in test USDC, checked against your budget. <Link href="/solana" className="underline font-semibold text-fg">Connect a Devnet wallet →</Link></p>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
    <Panel title="Your Solana wallet" right={<span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold">Solana Devnet</span>}>
      <p className="text-sm text-muted mb-4">Connect your own test wallet. Wallet balances are separate from the synthetic bank personas and are excluded from bank totals.</p>
      {connected ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{connected.wallet.name}</p>
              <a className="text-xs underline break-all" target="_blank" rel="noreferrer" href={`https://explorer.solana.com/address/${connected.account.address}?cluster=devnet`}>{connected.account.address}</a>
            </div>
            <button className="btn" disabled={busy} onClick={() => disconnect.dispatch()}>{disconnect.isRunning ? "Disconnecting…" : "Disconnect"}</button>
          </div>
          <Balances key={`${connected.account.address}:${balanceRevision}`} owner={connected.account.address} />
          {!payments && <Link href="/solana" className="btn btn-primary inline-flex">Pay with Solana</Link>}
        </div>
      ) : busy ? <p className="text-sm" role="status">{connect.isRunning ? "Approve the connection in your wallet…" : "Checking wallet connection…"}</p> : (
        <div className="flex flex-wrap gap-3">
          {wallets.map((wallet) => <button key={wallet.name} className="btn btn-primary" onClick={() => connect.dispatch(wallet)}>Connect {wallet.name}</button>)}
          {wallets.length === 0 && (
            <div className="space-y-3 text-sm">
              <p className="font-medium">Your Devnet wallet is not available in this tab yet.</p>
              <ol className="list-decimal pl-5 space-y-2 text-muted">
                <li>Open this page in a regular Chrome tab using the profile where Phantom is installed. Editor previews cannot access your browser extension.</li>
                <li>Open Phantom from the browser toolbar and unlock it. Keep Testnet Mode on with Solana Devnet selected.</li>
                <li>In Chrome, check Extensions → Phantom → Site access and allow it on this site, then reload.</li>
              </ol>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="btn" onClick={() => window.location.reload()}>Reload and detect wallet</button>
                <a className="underline" href="https://phantom.com/download" target="_blank" rel="noreferrer">Install Phantom if needed</a>
              </div>
            </div>
          )}
        </div>
      )}
      {Boolean((!connected && connect.error) || disconnect.error) && <p role="alert" className="mt-3 text-sm text-bad">{!connected && connect.error ? "Wallet connection was not completed. Check that your wallet is unlocked and supports Solana Devnet, then try again." : "Could not disconnect the wallet. Please try again."}</p>}
    </Panel>
    {payments && connected && <PaymentForm key={connected.account.address} owner={connected.account.address} onVerified={() => setBalanceRevision((revision) => revision + 1)} onBusy={setPaymentBusy} />}
    </div>
  );
}

export default function WalletPanel({ mode = "payments" }: { mode?: "payments" | "account" | "activity" }) {
  return <ClientProvider client={client}>{mode === "activity" ? <WalletActivity /> : <Connection payments={mode === "payments"} />}</ClientProvider>;
}
