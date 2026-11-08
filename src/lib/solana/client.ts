"use client";

import { createClient } from "@solana/kit";
import { solanaRpc } from "@solana/kit-plugin-rpc";
import { walletSigner } from "@solana/kit-plugin-wallet";

export { DEVNET_USDC_MINT } from "./payment";

// This client is loaded only in the browser by WalletLoader.
export const client = createClient()
  .use(walletSigner({ chain: "solana:devnet" }))
  .use(solanaRpc({
    rpcUrl: process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL || "https://api.devnet.solana.com",
  }));

export type SolanaClient = Awaited<typeof client>;
