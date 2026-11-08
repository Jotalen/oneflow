import { PageHeader } from "@/components/nova/ui";
import { WalletLoader } from "@/components/solana/WalletLoader";

export default function SolanaPage() {
  return (
    <>
      <PageHeader title="Solana" subtitle="Send test USDC with wallet approval and verified Devnet receipts." />
      <div className="space-y-4">
        <WalletLoader />
        <details className="panel p-4 sm:p-5">
          <summary className="font-semibold cursor-pointer">First time? Set up your demo wallet</summary>
          <div className="mt-3">
          <ol className="list-decimal pl-5 space-y-2 text-sm">
            <li>Install <a className="underline" href="https://phantom.com/download" target="_blank" rel="noreferrer">Phantom</a> and create a separate test wallet.</li>
            <li>In Phantom, open Settings → Developer Settings → Testnet Mode and select Solana Devnet.</li>
            <li>Copy your Solana public address and request free test SOL from the <a className="underline" href="https://faucet.solana.com" target="_blank" rel="noreferrer">Solana faucet</a>.</li>
            <li>Request test USDC from the <a className="underline" href="https://faucet.circle.com" target="_blank" rel="noreferrer">Circle faucet</a>, selecting Solana Devnet and the same address.</li>
            <li>Connect above and refresh your balances.</li>
          </ol>
          <p className="mt-4 text-xs text-muted">Use only test tokens. Your recovery phrase and private key stay in your wallet. For your first payment, create a second account in Phantom, copy its Devnet address, then switch back to your funded account before sending.</p>
          </div>
        </details>
      </div>
    </>
  );
}
