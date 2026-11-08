# Devpost draft — NextMove

**Tagline:** What's my next best move? The code computes, the AI explains, the bank executes.

## Inspiration
PNC and Toyota both literally ask "what's your next move?", and Capital One asks us to reimagine banking. Nobody's bank app knows their car; nobody's auto lender knows their cash flow. One person, three sponsors, one product.

## What it does
NextMove reads a person's bank from Capital One's Nessie v2, folds in their Toyota vehicle and loan/lease from the TFS data pack, computes 8 financial-health indicators and a 24-month projection, ranks concrete moves by dollar impact at month 24, shows "do nothing vs do this" futures, narrates with an LLM that is forbidden from doing arithmetic, and executes accepted moves as real Nessie transactions. Tiles adapt to the person: car card only if there's a car, and when a lease ends in 3 months it goes to the top. Vulnerable customers get one card: talk to a human.

Nessie v2 specifically: resumable seeding of 20 personas (customers, accounts, deposits, purchases, bills, loans, merchants), a polled event feed, a pending-transaction guard that decides via `POST /transactions/{id}/decision` (webhook decision-mode when deployed), and a bank-wide fraud monitor over an unlabeled historical simulation.

## How we built it
Next.js 16 + TypeScript, one process. A pure engine (`amortize`, `project`, `health`, `moves`, `guardrails`, `anomaly`, `guard`) with 120+ Vitest tests; the amortization is pinned to Toyota's own refinance payments. A typed Nessie client with a token bucket (120 req/min) behind a server proxy. LLM behind a provider interface: Gemini (function calling) or a deterministic offline narrator; six approved tools; Toyota's starter prompt verbatim plus a no-arithmetic rule. Eleven ADRs document the decisions. Docker + Caddy on Vultr, domain from GoDaddy.

## Challenges
- Nessie's simulator creates its own customers, so "fraud for Priya" is impossible; we made the monitor bank-wide and say so.
- Nessie has no loan-payment endpoint; extra principal executes as a labeled transfer.
- Ranking a lease buyout honestly: a lease is rent, not a loan. Modeling it as rent (with return fees and replacement transport in the baseline) is what makes our ranking land on Toyota's golden answers for C003/C001/C008/C014/C017.

## Accomplishments
Top car move matches TFS's reference answer for the demo personas, with the badge computed, not hard-coded. Guardrails enforced in code. The whole demo survives a Nessie outage via committed snapshots.

## What we learned
Deterministic math + narrating LLM is not a constraint, it's the product. Every number on screen is traceable to a CSV row or a Nessie response.

## What's next
Decision-mode webhooks everywhere, Markov health-state transitions, user-ranked analyses re-weighting the move order, real Toyota APIs.

## Built with
nextjs, typescript, tailwind, recharts, vitest, nessie-v2, gemini-api, docker, caddy, vultr, godaddy

## Links
Repo: https://github.com/moaizattiq/nextmove · Live: https://<domain> · Video: <youtube>
