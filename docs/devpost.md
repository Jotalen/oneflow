# Devpost draft: NovaBank (powered by NextMove)

**Tagline:** What's my next best move? The code computes, the AI explains, the bank executes.

**Tracks:** Capital One: Best Use of Nessie · Toyota Financial Services: What's Your Next Move? · PNC: 360° Financial Health Navigator · HackUTD: Design · MLH: Best Use of Gemini API, Best Use of Tiger Data, Best Domain Name from GoDaddy Registry

## Inspiration
PNC and Toyota both literally ask "what's your next move?", and Capital One asks us to reimagine banking. Your bank app doesn't know about your car, and your auto lender doesn't know your cash flow. So we built one bank that knows both, with one answer at the top of the screen.

## What it does
NovaBank is a full banking app: overview, accounts, transactions, budget, rewards, net worth, goals, safety net, debt, credit, car and house. A dashboard adapts to each person. Pinned on top is **NextMove**, the next best move for that person, ranked by dollar impact 24 months out.

- **The engine decides.** Deterministic TypeScript reads the person's bank (Capital One Nessie v2) and their Toyota loan or lease (TFS data pack). It computes 8 financial-health indicators and a 24-month projection, and ranks concrete moves.
- **The AI explains.** A tool-using coach narrates the engine's numbers and is forbidden from doing arithmetic. *Why this?* shows "do nothing vs do this" as two futures.
- **The bank executes.** Accepting a move posts real Nessie transactions (transfers, card payments, recurring bills, cancelled subscriptions), and the live event feed shows them settle.
- **Guardrails are features.** A vulnerable customer with missed payments gets one card: talk to a person. No offers, no dollar pitch. No marketing consent means no trade-in or renewal pitches.

## By track
**Capital One: Best Use of Nessie.** NovaBank uses Nessie as its real core bank. Customers, checking, savings and card accounts, merchants, bills (with dollars converted to integer cents), purchases and transfers all live in Nessie. Our NovaBank UI reads balances and the `/events` feed live and moves money only through Nessie. Customers can now send money to another NovaBank customer (P2P): a real Nessie transfer from their checking to the recipient's checking, checked server-side for account ownership, available balance, self-sends and limits, with an honest receipt that shows Nessie's own transaction id and status. Pending purchases go through our guard engine, which approves or declines them with `POST /transactions/{id}/decision`. We also built an HMAC-verified, de-duplicated decision-mode webhook with an idempotent registration script, so the same guard can answer Nessie live, before the purchase settles. Nothing is faked: if the bank can't execute an action, the button doesn't appear or the app says that nothing moved.
- We seed 20 real customers (accounts, paychecks, purchases, bills, loans, merchants), resumably.
- Accepted moves execute as real transactions.
- A shared server-side event cache polls `/events` once every 2 s for all tabs, staying inside the 120 req/min budget.
- **Demo of the guard:** an $800 Target swipe is approved within budget, and an $800 casino charge is declined by the blocked-category rule. Nessie marks it `declined` and releases the hold.
- A bank-wide fraud monitor runs our own rule detectors over an unlabeled historical simulation.
- The webhook is not registered yet. Until it is, the guard decides by polling the event feed.

**Toyota Financial Services: What's Your Next Move?** NovaBank's TFS portfolio view shows all 20 Toyota customers from Toyota Financial Services' side on one screen: our engine's top move for each one, the next step, the guardrail outcome, and the expected value from the data pack. Our top move matches Toyota's reference answer for 11 of 20 customers, and those matches carry $2,278 of the pack's $7,773 expected value. That figure is an estimate built only from golden_answers.csv take rates and value_drivers.csv dollar amounts. Seven customers finish in self-service with very-low-effort moves like autopay, extra principal and recall booking. Four vulnerable customers go straight to a person, and six sales offers are held back from them by code-enforced guardrails, not by the language model. Every number on the page traces back to the data pack or our deterministic engine, and the page lists its assumptions.
- *Personalize:* each of the 20 TFS customers drives their own profile, vehicle and contract.
- *Simplify:* every option shows the payment, total cost vs keeping as-is, the assumption and the trade-off in plain language. Numbers come from the pack, never the LLM.
- *Guide:* each move ends in a next step (self-service, follow-up, or an eligible offer). "No eligible offer" is an allowed answer.
- *Value:* a TFS view shows the reference answer, eligible offers with service effort, and expected value from `value_drivers.csv`. Its Portfolio sub-view rolls this up across all 20 customers.
- Our ranking matches TFS's golden answer for **11 of 20 customers**. The badge is computed, not hard-coded, and the misses are explained in the README.

**PNC: 360° Financial Health Navigator.** NovaBank includes an open-ended What-if simulator at /what-if. You move sliders for a pay cut or job loss, a one-time expense in a chosen month, extra payments toward a debt you pick, cancelling your actual recurring bills, or a new monthly bill. As you move them, the page compares a "do nothing" future with your what-if future over 24 months for both net worth and cash. It shows the change at month 24, your lowest cash point and when it happens, any overdraft fees, and which health indicators get better or worse. Every number comes from the same deterministic engine that drives our forecast and health scores, and the plain-English summary ("If you lose $1,000/mo of income, you run out of cash in month 17") is computed in code, not written by the AI. It is clearly labelled as a projection from today's balances and recurring cash flow, and it never moves money.
- One view across checking, savings, CDs, cards, auto loans and leases.
- **8 health indicators**, reimplemented from PNC's workshop package.
- A 24-month **balance and obligation forecast**, two futures per move, and the open-ended **What-if simulator** above.
- A **conversational coach** grounded in the engine.

**MLH: Best Use of Tiger Data.** The bank only tells you balances *now*.
- We stream every Nessie event into a TimescaleDB hypertable on Tiger Cloud. Balance-change events carry the new balance.
- A 15-minute continuous aggregate (`time_bucket` + `last()`) turns that into a real balance history per account, shown on the Accounts page with live activity counts (events stored, transactions posted, declines).
- The shared event poller keeps it current. TLS is verified against Tiger's pinned CA.

**HackUTD: Design.** Built from our own desktop and mobile wireframes, light and dark.
- The dashboard has rules that add bubbles when they matter, and the person can reorder, remove and add them.
- The next best move stays pinned.
- A 360° drag-to-rotate car sits on the car page.

## How we built it
- Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind v4 + Recharts. One process.
- A pure engine (`amortize`, `project`, `health`, `moves`, `guardrails`, `anomaly`, `guard`, `execute`), all in integer cents. 360+ Vitest tests; amortization is pinned to Toyota's own refinance payments.
- A typed Nessie client with a token bucket and `Retry-After` handling, behind a server proxy.
- LLM behind a provider interface with a fallback chain, **Gemini → OpenRouter → deterministic narrator**, so the coach never breaks the demo. Six approved tools; `execute_move` is confirm-only, so the model never moves money.
- Tiger Data (TimescaleDB) stores the bank's event stream as a hypertable with a continuous aggregate for balance history.
- Twelve ADRs record the decisions.

## Challenges
- Nessie's simulator creates its own customers, so per-person fraud history was impossible. We made the fraud monitor bank-wide and say so.
- Nessie has no loan-payment endpoint, so extra car principal executes as a labeled transfer into savings, never a fake payment.
- Ranking a lease buyout honestly: a lease is rent, not a loan. Modeling it as rent (with return fees and replacement transport in the baseline) is what makes the ranking land on Toyota's answers.
- Nessie announces a new card hold as `transaction.created` (status pending). Finding that live is what made the guard decide in time.

## Accomplishments
- Real money moves (including person-to-person payments) and real declines in the bank, decided by our rules.
- Toyota's golden answers matched by computation.
- Guardrails enforced in code, not in a prompt.
- The demo survives a Nessie or LLM outage (committed snapshots + offline narrator).

## What we learned
Deterministic math with an LLM that only narrates is not a limitation; it is the product. Every number on screen traces to a CSV row or a Nessie response.

## What's next
- Register the decision-mode webhook on the live deploy (the route and the registration script are ready).
- PAYOFF and due-date moves.
- Persist goals and dashboard edits server-side.
- Real TFS APIs.

## Built with
nextjs, react, typescript, tailwindcss, recharts, zod, vitest, capital-one-nessie, gemini-api, openrouter, tiger-data, timescaledb, postgresql, vercel, godaddy-registry

## Links
- Live: https://www.one-flow.us
- Repo: https://github.com/moaizattiq/oneflow
- Video: <add YouTube link>
