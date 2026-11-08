# NextMove — HackUTD 2026

> One question: **what's my next best move?** The code computes, the AI explains, the bank executes.

NextMove is a banking dashboard built on **Capital One's Nessie v2** that shows a person's whole financial picture (PNC 360° Financial Health Navigator), folds in their **Toyota** vehicle and loan/lease (Toyota Financial Services "What's Your Next Move?"), ranks concrete moves by their dollar impact 24 months out, shows "do nothing vs do this" futures, narrates with an LLM that never does arithmetic, and **executes accepted moves in the bank**.

**Tracks:** Capital One — Best Use of Nessie (primary) · Toyota Financial Services — What's Your Next Move? · PNC — 360° Financial Health Navigator · HackUTD — Design · MLH: Best Use of Gemini API, Best Use of Tiger Data, Best Domain Name from GoDaddy Registry (one-flow.us).

**Live:** https://www.one-flow.us · **Repo:** https://github.com/moaizattiq/oneflow

## 3-minute tour

1. **Pick a persona.** The 20 customers in Toyota's data pack are the personas; each is seeded into Nessie as a real customer with checking, savings, a credit card, paychecks, purchases, bills and the Toyota loan/lease.
2. **Next Moves.** Three cards, dollar impact in large type. For Priya (C003, lease 3 months out, over mileage) the top card is *Buy the car at lease end* with a **✓ matches TFS reference** badge — our ranking landed on Toyota's own golden answer.
3. **Two futures.** 24-month net-worth projection, do-nothing vs do-this, lease end and payoff marked.
4. **Accept.** The move posts a real Nessie transaction (transfer, recurring bill, cancelled bill). The event feed shows `pending → completed`; the projection re-runs.
5. **AI analyze / coach.** A tool-using LLM explains the engine's output and cannot do math. Provider chain: Gemini → OpenRouter → a deterministic offline narrator, so the coach never fails on an LLM outage.
6. **TFS view.** Same customer from Toyota's side: reference answer, eligible offers, expected value from `value_drivers.csv`. Switch to **Portfolio · all customers** for all 20 pack customers on one screen: our top move per customer, its next step, the guardrail outcome, and expected value counted only where our move matches TFS's reference (11 of 20, $2,278.05 of the pack's $7,773.14).
7. **Switch to Kevin (C014).** Vulnerable flag + two missed payments → one card: *Talk to a hardship specialist today*. No dollar amount, no offers. The guardrail is the feature.
8. **Pending-transaction guard + bank-wide fraud monitor.** Nessie v2 only: whenever the app is open, it decides every pending card transaction via `POST /transactions/{id}/decision` before it settles. The bell has two real demo swipes: $800 at Target (approved, within budget) and $800 at a casino (declined, blocked category; Nessie marks it `declined` and releases the hold). It also runs rule detectors over an unlabeled historical simulation.
9. **Send money.** Day-to-day → *Send money* pays another NovaBank customer: a real Nessie transfer from your checking to theirs, after a Review step and an explicit *Confirm send*. The receipt shows Nessie's own transaction id and status.
10. **What if.** `/what-if` lets you try a pay cut or job loss, a one-time expense, extra debt payments, cancelling real bills, or a new bill, and compares both 24-month futures (net worth and cash). It moves no money.

## Architecture (one process)

```
Toyota CSVs ─┐                      ┌─ /api/profile → Analysis {profile, health, ranked, tiles}
             ├─ normalize → Profile ─┤
Nessie v2  ──┘  (server proxy +      ├─ /api/execute → planExecution → Nessie ops → event feed → re-project
   bearer key,   token bucket)       ├─ /api/coach   → tool loop (6 tools) → Gemini → OpenRouter → stub
   120 req/min)                      ├─ /api/decide  → guardDecision → POST /transactions/{id}/decision
                                     ├─ /api/p2p     → validate → Nessie transfer (checking → their checking)
                                     ├─ /api/tfs-portfolio → engine over all 20 bundled snapshots (no live calls)
                                     └─ /api/fraud   → detectAnomalies over simulator accounts
```

- `src/lib/engine/` — pure TypeScript: `amortize`, `project` (24-month cash flow), `health` (8 indicators), `guardrails`, `moves/{bank,car,rank}`, `anomaly`, `guard`, `execute`. All money is integer cents.
- `src/lib/nessie/` — typed client with a token bucket (120/min, burst 30) and `Retry-After` handling; every call goes through the server.
- `src/lib/llm/` — provider interface with a fallback chain: `gemini` (function calling) → `openrouter` → `stub` (deterministic). Six approved tools (`execute_move` is confirm-only, so the model never moves money), Toyota starter prompt verbatim + a no-arithmetic rule.
- `scripts/seed.ts` — resumable per-persona seeding into Nessie; `scripts/reset.ts`; `scripts/simulate.ts` (historical run, seed 42); `scripts/snapshot.ts` (offline fallback).
- Decisions are recorded in `docs/adr/` (12 ADRs). Plan: `docs/superpowers/plans/2026-11-07-nextmove.md`.

## NovaBank UI (wireframe build)

The app is skinned as **NovaBank**, a full banking app built from our desktop + mobile wireframes: Overview, Day-to-day, Accounts, Transactions, Budget, Rewards, Net worth, Savings goals, Safety net, What if, Debt & liquidity, Credit score, Car financing (My lease or My loan / Shop & finance / TFS view with a Portfolio sub-view), House financing, Settings, and a mobile More menu with a bottom tab bar. Light by default; dark follows the device or Settings → Appearance.

- **Variable dashboard.** Bubbles are added by rules (`src/lib/bank/bubbles.ts`: e.g. car financing when a Toyota contract exists, safety net jumps to the top under 1 month, rewards when points are worth $20+). People can drag to reorder, remove and add; their edits always win (`/dashboard/edit`).
- **Next best move** stays pinned on top and rotates through the engine's top 3. Its button executes the move in Nessie; *Why this?* opens the two-futures chart and the AI coach.
- **Every number** comes from `src/lib/bank/view.ts`, a pure, tested view model over the engine analysis.
- **Real money moves:** `POST /api/transfer` (zod-validated, checks available balance, card payments capped at the balance) powers Add money, Pay card, and Move money. Engine move `pay_highest_apr` pays the card directly when the card is the highest-APR debt.
- **Send money (P2P):** `POST /api/p2p` `{persona, to, amountCents, memo?}` is zod-validated ($2,500 cap, 60-character memo, no control characters). It checks server-side that the sending account is yours, that you have the balance available, that you aren't paying yourself, and that the recipient's account is their own checking. If the bank is offline it answers 503 and nothing is sent. Incoming transfers now read as money in on the receiving account's ledger.
- **What if (`/what-if`):** all client-side, reusing the engine's `project()` and `health()` with no new math. The summary sentence ("If you lose $1,000/mo of income, you run out of cash in month 17") is built in code, not by the LLM. Card utilization and car equity are left out because the projection tracks total debt, not each account.
- **Balance history in Tiger Data.** Every Nessie event is stored in a TimescaleDB hypertable (`nessie_events`); `account.balance_changed` events carry the new balance, so a 15-minute continuous aggregate (`account_balance_15m`, `time_bucket` + `last()`) gives a real per-account balance history, charted on Accounts. The shared event poller keeps it current; `pnpm tiger:setup` / `pnpm tiger:backfill` create and fill it. See ADR-012.
- **Shared event cache:** `/api/events` keeps one upstream Nessie poll every 2 s and a bounded buffer. Without it, every tab replayed the whole event history, used up the 120 req/min budget, and pushed profile loads to over 90 s.

NovaBank honesty notes:
- Nessie stamps seeded transactions with the seed time, so posting dates are spread across the 8-week seed window. Charts show only the 30 days we can reconstruct; longer ranges are disabled.
- Credit score is an **estimate** from the Toyota credit tier, card use and missed payments, not a bureau score.
- Rewards points are computed from card purchases (3x dining, 2x groceries/gas, 1x else). Redemptions are recorded on the device only; Nessie has no rewards ledger.
- Savings goals are envelopes inside the real savings account, kept on the device. *Add money* moves real money in Nessie.
- No persona has a mortgage, investments or insurance, so those sections are empty or omitted. House financing is an affordability calculator.
- Toyota loans cannot be paid through Nessie, so the car "Pay it off faster" slider shows savings and tells you to ask TFS. Nothing fake is executed.

## Honesty notes (read these before judging the numbers)

- **All data is synthetic.** Toyota's pack says so; our bank data is generated from it. Nothing here is financial advice.
- **Spending is synthetic by construction.** Seeded purchases are derived from each persona's income, debt and stress score, then read back by the projection. Judges should treat the trajectories as illustrative.
- **Nessie's type model.** Nessie v2 has Checking, Savings, Credit Card, Loans and Bills. PNC's CDs/IRAs/mortgage groups appear only when modeled (two personas have a "CD 12mo" savings account); no persona has a mortgage. Nessie has no loan-payment endpoint, so "extra principal" executes as a transfer into a savings bucket named for the debt.
- **The simulator creates its own customers** (confirmed in the OpenAPI). The fraud monitor is bank-wide over those accounts, never per persona, and its three detectors are ours — the simulator plants anomalies but labels none.
- **A lease is modeled as rent.** No asset, no principal; the car becomes an asset at buyout. The do-nothing baseline for a lease includes the return fees from `option_scenarios.csv` and a synthetic $450/mo replacement-transport cost after return. This is why buyout outranks renewal for Priya; it also means renewal-golden personas (C006, C013) won't show the badge.
- **Webhooks.** The app is deployed on Vercel at https://www.one-flow.us, but the decision-mode webhook is **not registered yet**. Until it is, the guard polls `GET /events` every 2s (a new hold arrives as `transaction.created` with status `pending`) and decides via `POST /transactions/{id}/decision`, so `decision_source` reads `owner`. The webhook route (`/api/webhook/decision`) is built and tested, verifies the HMAC signature, de-duplicates deliveries, and refuses to answer without `NESSIE_WEBHOOK_SECRET`. The registration script is ready (see *Webhook registration* below).
- **TFS portfolio numbers are estimates.** Expected value is `golden_answers.csv` value-if-completed × assumed take rate (dollar values from `value_drivers.csv`), counted only where our top move equals the reference answer. Bank state is each customer's bundled snapshot re-run through the current engine, so live Nessie balances can differ.
- **Golden-answer badge: 11 of 20.** The badge is computed, never hard-coded. It fires for C001, C003, C005, C008, C009, C011, C012, C014, C015, C017, C019. The other nine miss for stated reasons: vulnerable-customer handoff overrides DEFER/AUTOPAY goldens (C002, C016); TRADE has no modeled dollar impact (C004, C007); DUEDATE ranks below another Toyota option for C018, and there is no PAYOFF move yet (C020); RELOCATE is a follow-up with no projected impact (C010); RENEW loses to BUYOUT on equity (C006, C013).
- **PNC parity.** We reimplemented the 8 indicators from PNC's `wellness` workshop package in TypeScript (`docs/pnc-parity.md`) and credit that repo; we did not vendor its code.

## Run it

```bash
pnpm install
cp .env.example .env.local        # add NESSIE_API_KEY (and GEMINI_API_KEY, LLM_PROVIDER=gemini) if you have them
pnpm dev                          # http://localhost:3000 — works with no keys (synthetic bank, offline narrator)
pnpm test                         # 360+ tests: engine, normalizer, guard, detectors, coach, P2P, TFS portfolio, what-if, API routes
pnpm seed --persona C003          # seed one persona into Nessie (resumable; `pnpm seed` for all 20)
pnpm simulate                     # one historical Nessie simulation → data/sim-ids.json (fraud monitor)
pnpm snapshot                     # refresh offline snapshots from live Nessie
```

Deployed on Vercel at https://www.one-flow.us. Self-hosting: `docker compose up -d` with `DOMAIN=your.domain` (Caddy terminates TLS).

## Webhook registration

The decision-mode webhook lets Nessie ask our guard about a purchase before it settles. `pnpm webhook:register` is idempotent: it lists existing hooks first, accepts https URLs only, writes the signing secret to `.env.webhook-secret` (mode 600, git-ignored), and never prints it. `--dry-run` shows what it would do. A hook must answer immediately, so a purchase the guard would normally *ask* you about (over $500 with under a month of runway) is **declined** with the reason "declined until you approve it in NovaBank"; register with `--on-error approve` so cards keep working if our server is unreachable.

1. Redeploy from `release` (the live site runs an earlier build until then).
2. `pnpm webhook:register --url https://www.one-flow.us/api/webhook/decision` saves `.env.webhook-secret`.
3. In Vercel → Project → Settings → Environment Variables (Production), set `NESSIE_WEBHOOK_SECRET` to the contents of that file.
4. Redeploy.
5. Run `pnpm webhook:register --url https://www.one-flow.us/api/webhook/decision --verify`, expect `delivered http 200`, then delete `.env.webhook-secret`.

Other flags: `--replace` swaps out a hook that points somewhere else, and `--rotate-secret` issues a new secret.

## Credits

Capital One Nessie v2 · Toyota Financial Services "Smartest Next Move" data pack (synthetic) · PNC Financial Wellness workshop (devfulcrum/pnc-utd-hackathon-2026, Apache-2.0) for the indicator definitions · Built at HackUTD 2026: Zero Day.
