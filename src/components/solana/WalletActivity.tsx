"use client";

import Link from "next/link";
import { useClient } from "@solana/react";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { Panel } from "@/components/nova/ui";
import type { SolanaClient } from "@/lib/solana/client";
import { useWalletReceipts } from "@/lib/solana/use-wallet-receipts";
import { ReceiptList } from "./ReceiptList";

function Activity({ owner }: { owner: string }) {
  const receipts = useWalletReceipts(owner);
  return (
    <Panel title="Solana payment activity" subtitle="Connected wallet · Devnet · receipts saved in this browser" right={<Link className="text-xs underline" href="/solana">Pay with Solana</Link>}>
      <p className="text-xs text-muted break-all mb-2">Wallet {owner}</p>
      {receipts.length ? <ReceiptList receipts={receipts} /> : <p className="text-sm text-muted">No payments made through OneFlow from this wallet yet.</p>}
      <p className="mt-3 text-xs text-muted">Wallet activity is separate from the selected demo bank profile. Receiving payments can be checked in the wallet or Explorer; this list contains payments sent through OneFlow.</p>
    </Panel>
  );
}

export function WalletActivity() {
  const connected = useConnectedWallet(useClient<SolanaClient>());
  return connected ? <Activity key={connected.account.address} owner={connected.account.address} /> : (
    <Panel title="Solana payment activity" subtitle="Solana Devnet">
      <p className="text-sm text-muted"><Link className="underline" href="/solana">Connect your test wallet</Link> to see its payment receipts alongside your bank transactions.</p>
    </Panel>
  );
}
