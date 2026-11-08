# Solana integration: context for the teammate

You're adding a Solana integration (MLH "Best Use of Solana": *"Build a project using Solana's fast, low-cost transactions, such as a game, payments platform, or decentralized application"*) to **NovaBank**. This page is everything you need to plug it in without breaking the demo or the repo.

- **Repo:** https://github.com/moaizattiq/oneflow (branch `main` = our working branch `release`)
- **Live:** https://www.one-flow.us (Vercel)
- **Final Devpost deadline:** Sun Nov 8, **12:00 PM CST**. Hand your branch back by **~10:00 AM** so it can be merged, tested and shown in the video.

---

## 1. What NovaBank is (60 seconds)
A full banking app (Overview, Accounts, Transactions, Budget, Rewards, Net worth, Goals, Car, What-if, …). Its hero is **NextMove**: "your next best move", ranked by dollar impact 24 months out.
- **The engine computes** (pure TypeScript in `src/lib/engine/`), **the AI only narrates** (Gemini → OpenRouter → offline narrator), and **the bank executes**: Capital One's **Nessie v2** mock bank holds the real accounts and moves real (fake) money.
- 20 demo customers ("personas") come from Toyota's data pack, e.g. `C003` Priya, `C018` Brian. Switch persona with `?p=C018`.
- Every number on screen comes from data or the engine. **No fake numbers, no fake buttons.** That honesty rule is the product's selling point.

## 2. Where Solana fits (pick what you're building; all are compatible)
| Idea | Plugs into | Notes |
|---|---|---|
| **Pay/send with Solana** (Solana Pay / USDC on devnet) | Next to our P2P **Send money** dialog: `src/components/nova/everyday/SendMoneyDialog.tsx`, route pattern `src/app/api/p2p/route.ts` | Show the real devnet tx signature + explorer link in the receipt |
| **Rewards as an on-chain token** (SPL token mint on devnet) | Rewards page `src/app/rewards/page.tsx`; points are computed in `src/lib/bank/view.ts` (`rewards`) | Redeeming points could mint or transfer tokens; label it "devnet" |
| **Crypto wallet as an account** (read a wallet's SOL/USDC balance) | Accounts page `src/app/accounts/page.tsx` (add a group), Net worth | **Don't** add a new `kind` to the engine's `BankAccount` (`src/lib/engine/types.ts`, `"checking"\|"savings"\|"cd"\|"card"`) unless you also update projection/health; a separate panel is safer |
| A new page | Add one line to `src/lib/nav.ts` (`NAV`); the sidebar and the mobile "More" page both read it | e.g. `{ href: "/crypto", label: "Crypto wallet" }` |

**Use devnet only.** Never mainnet, never a real-money wallet. Say "Solana devnet" in the UI wherever on-chain values appear.

## 3. Stack (read before coding)
- **Next.js 16.4.5** App Router + Turbopack. This is *not* the Next.js you know: check `node_modules/next/dist/docs/` for route/page APIs.
  - `cacheComponents: true` → **NEVER `export const dynamic`.** In route handlers that must run per request, call `await connection()` (`import { connection } from "next/server"`). See `src/app/api/events/route.ts`.
  - Route params are a Promise: `ctx: { params: Promise<{ persona: string }> }` (see `src/app/api/history/[persona]/route.ts`).
- **TypeScript**, **Tailwind v4**. Custom classes `.btn`, `.panel`, `.chip`, `.glass` are in `@layer components`. UI building blocks: `src/components/nova/ui.tsx` (`PageHeader`, `Panel`, `Tile`, …).
- **Recharts**, **zod 4** (validate every API body; copy `src/app/api/p2p/route.ts`), **Vitest**, **pnpm**.
- **Money is integer cents everywhere** (`src/lib/money.ts`, `fmtUSD`). Convert lamports or token units explicitly, and never mix floats into stored money.
- **Client pages** get the current customer from `useReadyBank()` / `useBank()` (`src/components/nova/BankProvider.tsx`): `personaId`, `analysis.profile`, `refresh()`.
- **React lint rule `react-hooks/set-state-in-effect` is enforced.** Don't call setState synchronously inside `useEffect`. Do it in `.then()` or event handlers, or use `useSyncExternalStore` (see `src/lib/bank/storedValue.ts`).
- A wallet adapter (Phantom etc.) must run **client-only** (`"use client"`). Keep server keys (if any) in route handlers only.

## 4. Run it locally
```bash
git clone https://github.com/moaizattiq/oneflow && cd oneflow
pnpm install
cp .env.example .env.local      # ask Moaiz for values over a private channel, never in Discord/Devpost/git
pnpm dev                        # http://localhost:3000/?p=C018
pnpm test                       # 363 tests must stay green
npx eslint src scripts          # must be 0 problems
npx tsc --noEmit -p .           # ignore errors under .next/types
```
Env var **names** (values are private):
- Bank: `NESSIE_API_KEY`, `NESSIE_BASE_URL`
- AI: `LLM_PROVIDER`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`
- Tiger: `DATABASE_URL`

Add yours as e.g. `SOLANA_RPC_URL` (devnet) and document it. Without a Nessie key the app runs on a synthetic bank, which is fine for UI work.

## 5. Rules (please follow; they protect the demo)
1. **Secrets:** never commit `.env*`, keypair JSON files or seed phrases. `.env*` is already git-ignored. If you need a devnet keypair file, put it under a git-ignored path and add that path to `.gitignore` in the same commit.
2. **The bank is shared and real:**
   - Nessie allows **120 requests/min for the whole team**.
   - **Never run** `pnpm seed`, `simulate` or `reset`.
   - **Never move money on C003 (Priya)**; she's the demo star.
   - **Don't swipe Brian's (C018) card**: it has just enough credit left for the two $800 demo swipes.
   - **Never POST to the live site (www.one-flow.us) to "test"**; it moves real money in Nessie. Test on localhost.
3. **Honesty:** show only real on-chain results (signature, explorer link, real balance). If something can't run, hide the button or say so. Label estimates.
4. **Commits:** conventional messages (`feat: …`, `fix: …`). **No `Co-Authored-By: Claude`/AI trailers in commit messages**; we had to rebuild the repo history once because of them. If you use an AI tool, strip that line before committing.
5. **Tests:** add Vitest tests for any pure logic (unit conversion, request building, validation) and mock the RPC. Keep `pnpm test`, eslint and tsc green.
6. **Mobile:** pages must work at 390px wide (no sideways scroll).
7. **Don't edit** `README.md` / `docs/devpost.md` heavily. Send Moaiz 3–5 sentences for the Devpost "Solana" section instead.

## 6. Hand-back (avoid merge pain)
1. Branch from the latest `main`: `git switch -c solana origin/main`.
2. Keep changes in new files where possible (e.g. `src/lib/solana/*`, `src/app/api/solana/*`, `src/components/solana/*`, a new page). Shared files we expect you to touch: `src/lib/nav.ts`, `package.json`/`pnpm-lock.yaml`, and maybe one line on an existing page.
3. Before handing back: `git fetch && git rebase origin/main`, then tests + eslint + tsc green, and a `next build` that passes.
4. Push your branch (`solana`) and tell Moaiz. Include:
   - what it does and how to try it (persona, page, steps)
   - new env var names
   - a devnet tx signature as proof
   - the Devpost paragraph
5. We'll review, merge, run the full checks and deploy.

## 7. Map of the codebase (where things live)
| Area | Path |
|---|---|
| Pages | `src/app/*/page.tsx` (`/`, `/accounts`, `/day-to-day`, `/rewards`, `/what-if`, `/car`, …) |
| API routes | `src/app/api/*/route.ts` (`p2p`, `transfer`, `profile/[persona]`, `events`, `history/[persona]`, `tfs-portfolio`, `dev/swipe`, `decide`, `webhook/decision`, `coach`) |
| Engine (pure) | `src/lib/engine/` (`normalize`, `project`, `health`, `guardrails`, `moves/*`, `execute`, `guard`) |
| Bank view model | `src/lib/bank/view.ts` (ledger, budget, rewards, credit estimate) |
| Nessie client | `src/lib/nessie/{client,api,types}.ts` (token bucket, typed endpoints) |
| Tiger Data (TimescaleDB) | `src/lib/tiger/*` |
| UI kit | `src/components/nova/ui.tsx`, `charts.tsx`; shell/nav `src/components/nova/Shell.tsx` + `src/lib/nav.ts` |
| Decisions (ADRs) | `docs/adr/001…012` |
| Tests | `tests/**` (Vitest; examples: `tests/api-p2p.test.ts` for routes, `tests/bank/*.test.ts` for pure logic) |

Questions → Moaiz.
