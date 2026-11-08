"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

function LoadingWallet() {
  return <p className="text-sm text-muted" role="status">Loading wallet connection…</p>;
}

const subscribe = () => () => {};
const browserSnapshot = () => true;
const serverSnapshot = () => false;

const WalletPanel = dynamic(() => import("./WalletPanel"), {
  loading: LoadingWallet,
});

export function WalletLoader({ mode = "payments" }: { mode?: "payments" | "account" | "activity" }) {
  // Render the same fallback on the server and during hydration. Only mount the
  // wallet SDK in the browser, without forcing Next's instant UI render to bail out.
  const hydrated = useSyncExternalStore(subscribe, browserSnapshot, serverSnapshot);
  if (!hydrated) return <LoadingWallet />;
  return <WalletPanel mode={mode} />;
}
