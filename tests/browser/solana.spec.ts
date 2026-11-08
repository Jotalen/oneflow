import { test, expect, type Page } from "@playwright/test";
import { address, generateKeyPairSigner, getAddressEncoder, getTransactionDecoder, getTransactionEncoder, getSignatureFromTransaction, signTransaction } from "@solana/kit";
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { analyze } from "../../src/lib/engine/analyze";
import { syntheticProfile } from "../../src/lib/server/analysis";
import { loadToyota } from "../../src/lib/toyota/load";

const mint = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const bank = analyze(syntheticProfile("C018"), loadToyota());

/** Ephemeral fixture wallet + mocked RPC. Browser tests never contact bank or chain APIs. */
async function setup(page: Page, wallet = true) {
  const sender = await generateKeyPairSigner();
  const recipient = await generateKeyPairSigner();
  const [source] = await findAssociatedTokenPda({ owner: sender.address, mint: address(mint), tokenProgram: TOKEN_PROGRAM_ADDRESS });
  const state = { broadcasts: 0, amount: "20000000", sol: 1_000_000_000, height: 999, reject: false, holdVerification: false, verificationCalls: 0 };
  await page.route("**/api/profile/*", (route) => route.fulfill({ json: bank }));
  await page.route("**/api/events**", (route) => route.fulfill({ json: { events: [], cursor: "0" } }));
  await page.route("**/api/solana/verify", async (route) => {
    state.verificationCalls++;
    const body = route.request().postDataJSON();
    await route.fulfill(state.holdVerification ? { status: 202, json: { ok: false, pending: true, error: "Awaiting confirmation" } } : {
      json: { ok: true, receipt: { ...body, network: "devnet", mint, slot: "123", blockTime: "1794119897", networkFee: "5000" } },
    });
  });
  await page.route("https://api.devnet.solana.com/**", async (route) => {
    const body = route.request().postDataJSON();
    const token = { amount: state.amount, decimals: 6, uiAmount: Number(state.amount) / 1_000_000, uiAmountString: String(Number(state.amount) / 1_000_000) };
    const info = { owner: sender.address, mint, tokenAmount: token };
    let result: unknown;
    switch (body.method) {
      case "getGenesisHash": result = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG"; break;
      case "getBalance": result = { context: { slot: 123 }, value: state.sol }; break;
      case "getTokenAccountsByOwner": result = { context: { slot: 123 }, value: [{ pubkey: source, account: { data: { program: "spl-token", parsed: { type: "account", info }, space: 165 }, owner: TOKEN_PROGRAM_ADDRESS, executable: false, lamports: 2_039_280, rentEpoch: 0, space: 165 } }] }; break;
      case "getAccountInfo": result = { context: { slot: 123 }, value: body.params[0] === source ? { owner: TOKEN_PROGRAM_ADDRESS, executable: false, lamports: 2_039_280, rentEpoch: 0, space: 165, data: { program: "spl-token", parsed: { type: "account", info }, space: 165 } } : null }; break;
      case "getLatestBlockhash": result = { context: { slot: 123 }, value: { blockhash: "11111111111111111111111111111111", lastValidBlockHeight: 1000 } }; break;
      case "getBlockHeight": result = state.height; break;
      case "getMinimumBalanceForRentExemption": result = 2_039_280; break;
      case "getFeeForMessage": result = { context: { slot: 123 }, value: 5000 }; break;
      case "sendTransaction": {
        state.broadcasts++;
        state.amount = "19000000";
        result = getSignatureFromTransaction(getTransactionDecoder().decode(Buffer.from(body.params[0], "base64")));
        break;
      }
      default: throw new Error(`Unexpected RPC in browser test: ${body.method}`);
    }
    await route.fulfill({ json: { jsonrpc: "2.0", id: body.id, result } });
  });
  if (wallet) {
    await page.exposeFunction("oneflowFixtureSign", async (bytes: number[], accountAddress: string) => {
      if (state.reject) throw new Error("User rejected test signature");
      const signer = accountAddress === sender.address ? sender : recipient;
      return Array.from(getTransactionEncoder().encode(await signTransaction([signer.keyPair], getTransactionDecoder().decode(Uint8Array.from(bytes)))));
    });
    await page.addInitScript(({ accounts }) => {
      type FixtureWindow = Window & { oneflowFixtureSign: (bytes: number[], owner: string) => Promise<number[]>; switchFixtureAccount: () => void };
      const fixture = window as unknown as FixtureWindow;
      let active = 0;
      const listeners = new Set<(value: unknown) => void>();
      const parsed = accounts.map((account) => ({ ...account, publicKey: Uint8Array.from(account.publicKey), chains: ["solana:devnet"], features: ["solana:signTransaction"] }));
      const wallet = {
        version: "1.0.0", name: "OneFlow Test Wallet", icon: "data:image/svg+xml;base64,PHN2Zy8+", chains: ["solana:devnet"],
        get accounts() { return [parsed[active]]; },
        features: {
          "standard:connect": { version: "1.0.0", connect: async () => ({ accounts: [parsed[active]] }) },
          "standard:disconnect": { version: "1.0.0", disconnect: async () => {} },
          "standard:events": { version: "1.0.0", on: (_event: string, listener: (value: unknown) => void) => { listeners.add(listener); return () => listeners.delete(listener); } },
          "solana:signTransaction": { version: "1.0.0", supportedTransactionVersions: [0, "legacy"], signTransaction: async (...inputs: { transaction: Uint8Array; account: { address: string } }[]) => Promise.all(inputs.map(async (input) => ({ signedTransaction: Uint8Array.from(await fixture.oneflowFixtureSign(Array.from(input.transaction), input.account.address)) }))) },
        },
      };
      fixture.switchFixtureAccount = () => { active = active ? 0 : 1; listeners.forEach((listener) => listener({ accounts: [parsed[active]] })); };
      const register = ({ register }: { register: (wallet: unknown) => void }) => register(wallet);
      window.addEventListener("wallet-standard:app-ready", (event) => register((event as CustomEvent).detail));
      window.dispatchEvent(new CustomEvent("wallet-standard:register-wallet", { detail: register }));
    }, { accounts: [sender, recipient].map((signer) => ({ address: signer.address, publicKey: Array.from(getAddressEncoder().encode(signer.address)) })) });
  }
  return { sender, recipient, state };
}

async function connect(page: Page) {
  await page.goto("/solana?p=C018");
  await page.getByRole("button", { name: "Connect OneFlow Test Wallet" }).click();
  await expect(page.getByLabel("Recipient wallet address")).toBeEditable();
}

test("shows recovery guidance without an extension and fits the viewport", async ({ page }) => {
  const renderingErrors: string[] = [];
  page.on("pageerror", (error) => renderingErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /Could not validate|instant UI|Browser-only rendering/.test(message.text())) {
      renderingErrors.push(message.text());
    }
  });
  await setup(page, false);
  await page.goto("/solana?p=C018");
  await expect(page.getByText("Your Devnet wallet is not available in this tab yet.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(renderingErrors).toEqual([]);
});

test("reviews a budget-aware payment, signs, verifies once, and shares the receipt with Transactions", async ({ page }) => {
  const { recipient, state } = await setup(page);
  await connect(page);
  await page.getByLabel("Recipient wallet address").fill(recipient.address);
  await page.getByLabel("Amount in test USDC").fill("1");
  await page.getByRole("button", { name: "Review payment", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Before you pay: demo budget impact" })).toBeVisible();
  await expect(page.getByLabel("Compare with category")).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("solana-review.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Approve in wallet", exact: true }).click();
  await expect(page.getByText("Verified on Devnet", { exact: true })).toBeVisible();
  await expect(page.getByText(/Submission → verified receipt:/)).toBeVisible();
  expect(state.broadcasts).toBe(1);
  await page.goto("/transactions?p=C018");
  await expect(page.getByRole("heading", { name: "Solana payment activity" })).toBeVisible();
  await expect(page.getByText("Verified on Devnet", { exact: true })).toBeVisible();
  await page.goto("/accounts?p=C018");
  await expect(page.getByRole("heading", { name: "Your Solana wallet" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Pay with Solana", exact: true })).toBeVisible();
});

test("rejecting wallet approval does not broadcast and keeps the review usable", async ({ page }) => {
  const { recipient, state } = await setup(page);
  state.reject = true;
  await connect(page);
  await page.getByLabel("Recipient wallet address").fill(recipient.address);
  await page.getByLabel("Amount in test USDC").fill("1");
  await page.getByRole("button", { name: "Review payment", exact: true }).click();
  await page.getByRole("button", { name: "Approve in wallet", exact: true }).click();
  await expect(page.locator("p[role=alert]")).toBeVisible();
  expect(state.broadcasts).toBe(0);
  await expect(page.getByRole("button", { name: "Edit payment", exact: true })).toBeEnabled();
});

test("automatically resolves a saved pending signature after reload without another send", async ({ page }) => {
  const { sender, recipient, state } = await setup(page);
  await page.addInitScript(({ sender, recipient }) => {
    localStorage.setItem(`nova:solana:devnet:receipts:${sender}`, JSON.stringify([{ sender, recipient, amount: "1000000", signature: "1".repeat(64), lastValidBlockHeight: "1000", status: "pending", createdAt: "2026-11-08T06:00:00Z" }]));
  }, { sender: sender.address, recipient: recipient.address });
  await connect(page);
  await expect(page.getByText("Verified on Devnet", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Review payment", exact: true })).toBeEnabled();
  expect(state.broadcasts).toBe(0);
  expect(state.verificationCalls).toBeGreaterThan(0);
});

test("switching accounts resets the form and rejects self-payments before signing", async ({ page }) => {
  const { sender, recipient, state } = await setup(page);
  await connect(page);
  await page.getByLabel("Recipient wallet address").fill(recipient.address);
  await page.evaluate(() => (window as unknown as { switchFixtureAccount: () => void }).switchFixtureAccount());
  await expect(page.getByLabel("Recipient wallet address")).toHaveValue("");
  await page.getByLabel("Recipient wallet address").fill(recipient.address);
  await page.getByLabel("Amount in test USDC").fill("1");
  await page.getByRole("button", { name: "Review payment", exact: true }).click();
  await expect(page.locator("p[role=alert]")).toContainText("different recipient");
  expect(state.broadcasts).toBe(0);
  await expect(page.getByRole("link", { name: sender.address, exact: true })).toHaveCount(0);
});

test("a pending receipt keeps drafts editable but blocks a duplicate send until resolved", async ({ page }) => {
  const { sender, recipient, state } = await setup(page);
  state.holdVerification = true;
  await page.addInitScript(({ sender, recipient }) => {
    localStorage.setItem(`nova:solana:devnet:receipts:${sender}`, JSON.stringify([{ sender, recipient, amount: "1000000", signature: "1".repeat(64), lastValidBlockHeight: "1000", status: "pending", createdAt: "2026-11-08T06:00:00Z" }]));
  }, { sender: sender.address, recipient: recipient.address });
  await connect(page);
  await page.getByLabel("Recipient wallet address").fill(recipient.address);
  await page.getByLabel("Amount in test USDC").fill("0.5");
  await expect(page.getByRole("button", { name: "Review payment", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Check previous payment" })).toBeEnabled();
  state.holdVerification = false;
  await page.getByRole("button", { name: "Check previous payment" }).click();
  await expect(page.getByText("Verified on Devnet", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Review payment", exact: true })).toBeEnabled();
  await expect(page.getByLabel("Amount in test USDC")).toHaveValue("0.5");
  expect(state.broadcasts).toBe(0);
});

test("an expired quote asks for a new review without signing or sending", async ({ page }) => {
  const { recipient, state } = await setup(page);
  await connect(page);
  await page.getByLabel("Recipient wallet address").fill(recipient.address);
  await page.getByLabel("Amount in test USDC").fill("1");
  await page.getByRole("button", { name: "Review payment", exact: true }).click();
  await expect(page.getByRole("button", { name: "Approve in wallet", exact: true })).toBeVisible();
  state.height = 1001;
  await page.getByRole("button", { name: "Approve in wallet", exact: true }).click();
  await expect(page.locator("p[role=alert]")).toContainText("quote expired");
  expect(state.broadcasts).toBe(0);
});

test("insufficient SOL is caught before wallet approval", async ({ page }) => {
  const { recipient, state } = await setup(page);
  state.sol = 0;
  await connect(page);
  await page.getByLabel("Recipient wallet address").fill(recipient.address);
  await page.getByLabel("Amount in test USDC").fill("1");
  await page.getByRole("button", { name: "Review payment", exact: true }).click();
  await expect(page.locator("p[role=alert]")).toContainText("Not enough test SOL");
  expect(state.broadcasts).toBe(0);
});
