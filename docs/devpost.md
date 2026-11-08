# Devpost draft: NovaBank (powered by NextMove)

**Tagline:** What's my next best move? The code computes, the AI explains, the bank executes.

**Tracks:** Capital One: Best Use of Nessie · Toyota Financial Services: What's Your Next Move? · PNC: 360° Financial Health Navigator · HackUTD: Design · MLH: Best Use of Gemini API

## Inspiration
PNC and Toyota both literally ask "what's your next move?", and Capital One asks us to reimagine banking. Your bank app doesn't know about your car, and your auto lender doesn't know your cash flow. So we built one bank that knows both, with one answer at the top of the screen.

## What it does
NovaBank is a full banking app: overview, accounts, transactions, budget, rewards, net worth, goals, safety net, debt, credit, car and house. A dashboard adapts to each person. Pinned on top is **NextMove**, the next best move for that person, ranked by dollar impact 24 months out.

- **The engine decides.** Deterministic TypeScript reads the person's bank (Capital One Nessie v2) and their Toyota loan or lease (TFS data pack). It computes 8 financial-health indicators and a 24-month projection, and ranks concrete moves.
- **The AI explains.** A tool-using coach narrates the engine's numbers and is forbidden from doing arithmetic. *Why this?* shows "do nothing vs do this" as two futures.
- **The bank executes.** Accepting a move posts real Nessie transactions (transfers, card payments, recurring bills, cancelled subscriptions), and the live event feed shows them settle.
- **Guardrails are features.** A vulnerable customer with missed payments gets one card: talk to a person. No offers, no dollar pitch. No marketing consent means no trade-in or renewal pitches.

## By track
**Capital One: Best Use of Nessie.** Nessie is the source of truth, not decoration.
- We seed 20 real customers (accounts, paychecks, purchases, bills, loans, merchants), resumably.
- Accepted moves execute as real transactions.
- A shared server-side event cache polls `/events` once every 2 s for all tabs, staying inside the 120 req/min budget.
- **A pending-transaction guard decides card holds before they settle** via `POST /transactions/{id}/decision`. Demo: an $800 Target swipe is approved within budget, and an $800 casino charge is declined by the blocked-category rule. Nessie marks it `declined` and releases the hold.
- A bank-wide fraud monitor runs our own rule detectors over an unlabeled historical simulation.
- A signed decision-mode webhook (HMAC-verified, de-duplicated) is built and tested, ready for an HTTPS deploy.

**Toyota Financial Services: What's Your Next Move?**
- *Personalize:* each of the 20 TFS customers drives their own profile, vehicle and contract.
- *Simplify:* every option shows the payment, total cost vs keeping as-is, the assumption and the trade-off in plain language. Numbers come from the pack, never the LLM.
- *Guide:* each move ends in a next step (self-service, follow-up, or an eligible offer). "No eligible offer" is an allowed answer.
- *Value:* a TFS view shows the reference answer, eligible offers with service effort, and expected value from `value_drivers.csv`.
- Our ranking matches TFS's golden answer for **11 of 20 customers**. The badge is computed, not hard-coded, and the misses are explained in the README.

**PNC: 360° Financial Health Navigator.**
- One view across checking, savings, CDs, cards, auto loans and leases.
- **8 health indicators**, reimplemented from PNC's workshop package.
- A 24-month **balance and obligation forecast** and a **what-if simulator** (two futures per move).
- A **conversational coach** grounded in the engine.

**HackUTD: Design.** Built from our own desktop and mobile wireframes, light and dark.
- The dashboard has rules that add bubbles when they matter, and the person can reorder, remove and add them.
- The next best move stays pinned.
- A 360° drag-to-rotate car sits on the car page.

## How we built it
- Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind v4 + Recharts. One process.
- A pure engine (`amortize`, `project`, `health`, `moves`, `guardrails`, `anomaly`, `guard`, `execute`), all in integer cents. 250+ Vitest tests; amortization is pinned to Toyota's own refinance payments.
- A typed Nessie client with a token bucket and `Retry-After` handling, behind a server proxy.
- LLM behind a provider interface with a fallback chain, **Gemini → OpenRouter → deterministic narrator**, so the coach never breaks the demo. Six approved tools; `execute_move` is confirm-only, so the model never moves money.
- Eleven ADRs record the decisions.

## Challenges
- Nessie's simulator creates its own customers, so per-person fraud history was impossible. We made the fraud monitor bank-wide and say so.
- Nessie has no loan-payment endpoint, so extra car principal executes as a labeled transfer into savings, never a fake payment.
- Ranking a lease buyout honestly: a lease is rent, not a loan. Modeling it as rent (with return fees and replacement transport in the baseline) is what makes the ranking land on Toyota's answers.
- Nessie announces a new card hold as `transaction.created` (status pending). Finding that live is what made the guard decide in time.

## Accomplishments
- Real money moves and real declines in the bank, decided by our rules.
- Toyota's golden answers matched by computation.
- Guardrails enforced in code, not in a prompt.
- The demo survives a Nessie or LLM outage (committed snapshots + offline narrator).

## What we learned
Deterministic math with an LLM that only narrates is not a limitation; it is the product. Every number on screen traces to a CSV row or a Nessie response.

## What's next
- Deploy with decision-mode webhooks.
- PAYOFF and due-date moves.
- Persist goals and dashboard edits server-side.
- Real TFS APIs.

## Built with
nextjs, react, typescript, tailwindcss, recharts, zod, vitest, capital-one-nessie, gemini-api, openrouter

## Links
- Repo: https://github.com/moaizattiq/novabank-nextmove
- Video: <add YouTube link>
