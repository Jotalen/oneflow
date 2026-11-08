import { address, createSolanaRpc, signature } from "@solana/kit";
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { DEVNET_CHAIN_REFERENCE, DEVNET_USDC_MINT, VerifyPaymentSchema } from "@/lib/solana/payment";
import { verifyConfirmedPayment } from "@/lib/solana/verify-payment";

/** Public read-only verification; never accepts keys, signs, or changes bank balances. */
export async function POST(req: Request) {
  const parsed = VerifyPaymentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Invalid payment details or signature." }, { status: 400 });
  const request = parsed.data;
  try {
    const rpc = createSolanaRpc(process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL || "https://api.devnet.solana.com");
    const options = { abortSignal: AbortSignal.timeout(12_000) };
    const genesis = await rpc.getGenesisHash().send(options);
    if (!genesis.startsWith(DEVNET_CHAIN_REFERENCE)) return Response.json({ ok: false, error: "The verification server must use Solana Devnet." }, { status: 503 });
    const tx = await rpc.getTransaction(signature(request.signature), { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 }).send(options);
    if (!tx) {
      const [statuses, height] = await Promise.all([
        rpc.getSignatureStatuses([signature(request.signature)], { searchTransactionHistory: true }).send(options),
        rpc.getBlockHeight({ commitment: "confirmed" }).send(options),
      ]);
      if (statuses.value[0]?.err) return Response.json({ ok: false, failed: true, error: "The transaction failed on Solana. No USDC payment was completed." }, { status: 422 });
      if (!statuses.value[0] && height > BigInt(request.lastValidBlockHeight)) return Response.json({ ok: false, expired: true, error: "The transaction expired without being recorded on Devnet." }, { status: 410 });
      return Response.json({ ok: false, pending: true, error: "Awaiting confirmed transaction details. Check again shortly." }, { status: 202 });
    }
    const mint = address(DEVNET_USDC_MINT);
    const [source, destination] = await Promise.all([
      findAssociatedTokenPda({ owner: address(request.sender), mint, tokenProgram: TOKEN_PROGRAM_ADDRESS }),
      findAssociatedTokenPda({ owner: address(request.recipient), mint, tokenProgram: TOKEN_PROGRAM_ADDRESS }),
    ]);
    try {
      const receipt = verifyConfirmedPayment(tx, request, { source: source[0], destination: destination[0] });
      return Response.json({ ok: true, receipt });
    } catch (error) {
      return Response.json({ ok: false, failed: tx.meta?.err != null, error: error instanceof Error ? error.message : "Payment verification failed." }, { status: 422 });
    }
  } catch {
    return Response.json({ ok: false, error: "Could not reach Solana Devnet for verification. Keep the transaction link and check again; do not resend this payment." }, { status: 502 });
  }
}
