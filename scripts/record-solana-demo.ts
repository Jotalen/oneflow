/** Read-only demo: real public Devnet balances + an existing verified payment. Never signs or broadcasts. */
import { chromium } from "@playwright/test";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { address, getAddressEncoder } from "@solana/kit";
import { analyze } from "../src/lib/engine/analyze";
import { syntheticProfile } from "../src/lib/server/analysis";
import { loadToyota } from "../src/lib/toyota/load";
import type { VerifiedPayment } from "../src/lib/solana/payment";

async function main() {
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const output = path.resolve("artifacts/solana");
const sender = "2ukjjamWjuusw45XSRg4ojQkMPhZ4t3f9Qf9Ewom4KeV";
const recipient = "Hg7pEwoJqaiDHJP9eoAVoXcFwxXRT4vLNorg3ScFVDbr";
const signature = "3SWY7KHErQBrxzp4st6bEGqMU7LwdYKZobc1xHz6jeAKvFoNvnXHwsrF4R7P8tNbzz94sSKza1GCaYG9dXzaQGPk";
const proofResponse = await fetch(`${baseURL}/api/solana/verify`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ sender, recipient, signature, amount: "1000000", lastValidBlockHeight: "0" }),
});
const proof = await proofResponse.json();
if (!proofResponse.ok || !proof.ok) throw new Error("The existing real Devnet payment could not be verified. No demo was recorded.");

await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ timezoneId: "America/Chicago", viewport: { width: 1440, height: 1000 }, recordVideo: { dir: output, size: { width: 1440, height: 1000 } } });
const page = await context.newPage();
await page.route("**/api/profile/*", (route) => route.fulfill({ json: analyze(syntheticProfile("C018"), loadToyota()) }));
await page.route("**/api/events**", (route) => route.fulfill({ json: { events: [], cursor: "0" } }));
await page.route("https://api.devnet.solana.com/**", async (route) => {
  if (!String(route.request().postDataJSON().method).startsWith("get")) throw new Error("Read-only walkthrough only permits RPC reads.");
  const response = await fetch("https://api.devnet.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: route.request().postData(), signal: AbortSignal.timeout(20_000) });
  await route.fulfill({ status: response.status, contentType: "application/json", body: await response.text() });
});
const initializeDemo = ({ sender, publicKey, proof }: { sender: string; publicKey: number[]; proof: { receipt: VerifiedPayment } }) => {
  const account = { address: sender, publicKey: Uint8Array.from(publicKey), chains: ["solana:devnet"], features: ["solana:signTransaction"] };
  const wallet = {
    version: "1.0.0", name: "Public Devnet wallet (read-only walkthrough)", icon: "data:image/svg+xml;base64,PHN2Zy8+", chains: ["solana:devnet"], accounts: [account],
    features: {
      "standard:connect": { version: "1.0.0", connect: async () => ({ accounts: [account] }) },
      "standard:disconnect": { version: "1.0.0", disconnect: async () => {} },
      "standard:events": { version: "1.0.0", on: () => () => {} },
      "solana:signTransaction": { version: "1.0.0", supportedTransactionVersions: [0], signTransaction: async () => { throw new Error("Read-only walkthrough: signing is disabled."); } },
    },
  };
  const register = ({ register }: { register: (wallet: unknown) => void }) => register(wallet);
  window.addEventListener("wallet-standard:app-ready", (event) => register((event as CustomEvent).detail));
  window.dispatchEvent(new CustomEvent("wallet-standard:register-wallet", { detail: register }));
  localStorage.setItem("nova:theme", "dark");
  localStorage.setItem(`nova:solana:devnet:receipts:${sender}`, JSON.stringify([{ ...proof.receipt, status: "verified", receipt: proof.receipt, createdAt: new Date(Number(proof.receipt.blockTime) * 1000).toISOString() }]));
  document.addEventListener("DOMContentLoaded", () => {
    const caption = document.createElement("div");
    caption.id = "oneflow-demo-caption";
    caption.textContent = "OneFlow · Read-only walkthrough · Actual Devnet balances and an existing confirmed payment";
    caption.style.cssText = "position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:99999;max-width:90%;padding:14px 22px;border-radius:12px;background:#172b24;color:white;font:600 16px system-ui;box-shadow:0 4px 24px #0006;text-align:center;pointer-events:none";
    document.body.append(caption);
  });
};
// tsx preserves nested function names using __name; provide that helper in this
// recording-only browser bootstrap. No application code or wallet keys are injected.
await page.addInitScript({ content: `globalThis.__name = (fn) => fn; (${initializeDemo.toString()})(${JSON.stringify({ sender, publicKey: Array.from(getAddressEncoder().encode(address(sender))), proof })});` });

async function caption(text: string) {
  await page.locator("#oneflow-demo-caption").evaluate((element, value) => { element.textContent = value; }, text);
  await page.waitForTimeout(4_000);
}
try {
  await page.goto(`${baseURL}/accounts?p=C018`);
  await page.getByRole("heading", { name: "Your Solana wallet" }).waitFor();
  const connect = page.getByRole("button", { name: "Connect Public Devnet wallet (read-only walkthrough)" });
  if (await connect.isVisible()) await connect.click();
  await page.getByRole("link", { name: sender, exact: true }).waitFor();
  await page.getByRole("heading", { name: "Your Solana wallet" }).scrollIntoViewIfNeeded();
  await page.getByText("Test USDC", { exact: true }).waitFor();
  await caption("One financial world: live Devnet wallet balances alongside demo bank accounts. Test funds stay separate.");
  await page.screenshot({ path: path.join(output, "accounts.png"), fullPage: true });
  await page.goto(`${baseURL}/day-to-day?p=C018`);
  await page.getByRole("link", { name: "Pay with Solana", exact: true }).first().waitFor();
  await caption("Day-to-day links directly to wallet-approved Solana payments.");
  await page.getByRole("link", { name: "Pay with Solana", exact: true }).first().click();
  await page.getByLabel("Recipient wallet address").fill(recipient);
  await page.getByLabel("Amount in test USDC").fill("1");
  await page.getByRole("button", { name: "Review payment", exact: true }).click();
  await page.getByRole("heading", { name: "Before you pay: demo budget impact" }).waitFor();
  await page.getByRole("heading", { name: "Before you pay: demo budget impact" }).scrollIntoViewIfNeeded();
  await caption("Review exact USDC, actual quoted fees, and a hypothetical impact on the selected demo budget.");
  await page.screenshot({ path: path.join(output, "budget-review.png"), fullPage: true });
  await caption("Live payments require Phantom approval. This recording is read-only and does not sign or send a new payment.");
  await page.goto(`${baseURL}/transactions?p=C018`);
  await page.getByText("Verified on Devnet", { exact: true }).waitFor();
  await page.getByRole("heading", { name: "Solana payment activity" }).scrollIntoViewIfNeeded();
  await caption("This earlier 1-USDC payment was approved by the user and independently verified against Solana Devnet.");
  await page.screenshot({ path: path.join(output, "verified-activity.png"), fullPage: true });
  await caption("The receipt links to public on-chain proof and reports the actual network fee: 0.000005 SOL.");
} finally {
  await page.screenshot({ path: path.join(output, "last-frame.png"), fullPage: true }).catch(() => {});
  const video = page.video();
  await context.close();
  if (video) await rename(await video.path(), path.join(output, "oneflow-solana-proof.webm"));
  await browser.close();
}
await writeFile(path.join(output, "proof.json"), JSON.stringify(proof.receipt, null, 2));
console.log(`Read-only demo and screenshots saved to ${output}`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "Demo recording failed"); process.exitCode = 1; });
