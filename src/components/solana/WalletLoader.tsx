"use client";

import dynamic from "next/dynamic";

const WalletPanel = dynamic(() => import("./WalletPanel"), {
  ssr: false,
  loading: () => <p className="text-sm text-muted" role="status">Loading wallet connection…</p>,
});

export function WalletLoader({ mode = "payments" }: { mode?: "payments" | "account" | "activity" }) {
  return <WalletPanel mode={mode} />;
}
