# HackUTD 2026 ("Zero Day") — Full Context Pack

Purpose: everything known about the hackathon, the sponsor tracks, the data, the APIs, and the plan so far, in one file.
Hand this to Claude Code (or any agent) as project context. Written Saturday Nov 7, 2026.

---

## 0. TL;DR of the plan

- **Event:** HackUTD 2026: Zero Day, UT Dallas (ECSW), Nov 7–8, 2026. 24 hours. ~1,200 hackers, ~230+ projects expected.
- **Hard deadlines:** team registered on Devpost by **11:00 PM Sat Nov 7** (placeholder OK). Final submission **12:00 PM (noon) Sun Nov 8 CST**. No edits after.
- **Rules:** up to **3 sponsor tracks + 1 HackUTD track** per team (Devpost page). Unlimited MLH tracks. **Public GitHub repo required.** Teams up to 4.
- **Chosen sponsor tracks (3):** Capital One (Best Use of Nessie) + PNC (360° Financial Health Navigator) + Toyota Financial Services ("What's Your Next Move?").
- **MLH add-ons planned:** Vultr (deploy), GoDaddy Registry (domain), optionally Gemini API (coach model).
- **Product concept: "NextMove"** — one product that answers one question: *what's my next best move?* It builds a person's full financial picture from Nessie (bank), layers in their Toyota vehicle + loan/lease (Toyota data pack), computes health metrics and a 24-month projection, ranks concrete moves by dollar impact, shows "do nothing vs do this" futures, explains in plain language via an LLM that never does math, and can **execute** the chosen move in the bank via Nessie. Both PNC and Toyota literally use the phrase "next move" in their challenge statements.
- **Team:** Richard, solo as of now (may add a beginner later). Business student (fintech lead, accounting/econ), full-stack dev, runs a small software consultancy, comfortable with AI/agents.

---

## 1. Event facts and rules

| Item | Value | Source |
|---|---|---|
| Name | HackUTD 2026: Zero Day ("the city needs you") | zeroday.hackutd.co |
| Presenting sponsor | T-Mobile | slides |
| Dates | Nov 7–8, 2026, 24 hours | devpost |
| Location | UT Dallas, ECSW | devpost |
| Devpost | hackutd-zeroday.devpost.com | devpost |
| Team registration deadline | Sat 11:00 PM on Devpost (first submit; editable after) | devpost + tech guide |
| Final submission deadline | **Sun 12:00 PM CST** | devpost |
| Sponsor track cap | **Up to 3 sponsor tracks + 1 HackUTD track** (devpost page; an older tech guide said 2) | devpost |
| MLH tracks | unlimited | devpost |
| Repo | public GitHub link required; private repos can disqualify | tech guide |
| Overall prizes | $20,000 cash across 1st/2nd/3rd | devpost |
| HackUTD tracks | Best Hardware, Best Design, Virality (prizes not listed) | devpost |
| Other | CTF challenge exists; details not captured | devpost |
| Key resources | Hacker Portal, Hackerpack, Discord (QR codes on opening slide) | slides |
| Last year | 1,200+ participants, 30 universities, 230+ projects | techtitans listing |

---

## 2. Every sponsor track (from opening-ceremony slides)

### 2.1 T-Mobile — "Safe Signal" (presenting sponsor)
- **Prompt:** Protect customers from scams and fraud in ways we haven't thought of yet.
- **You build:** any approach: prevention, real-time protection, education, new security features. Scam detection is a core piece, not the whole product. Go beyond classification: safeguards and customer-facing experiences. Clear next steps, honest confidence, privacy by design.
- **You create the data:** build your own synthetic scam messages/scenarios. No real customer data.
- **Judges look for:** creativity, impact, usability, security and privacy, detection quality.
- **"The big unlock":** customers feel protected before, during, and after a threat.
- **Prizes:** 1st Apple Mac mini · 2nd NVIDIA Jetson Orin Nano Super · 3rd Plaud NotePin S. **Bonus:** all winning team members get to interview for a T-Mobile internship.
- **Assessment:** highest competition in the building. Not chosen.

### 2.2 PNC — "360° Financial Health Navigator"  ← CHOSEN
- **Prompt:** How could AI help someone see their whole financial picture, make sense of it & feel confident about their next move?
- **Account types named:** Checking, Savings, CDs & IRAs, Loans, Credit Cards, Mortgages.
- **Framing:** most people keep money in many places; few have *one clear view* of how they're doing or what to do next. Reimagine how people understand and manage their financial lives.
- **"Your answer might be…":** a conversational coach · 3+ health assessment indicators · forecast balances & financial obligations · "what if" simulator · something no one has thought of yet.
- **Prizes:** 1st PlayStation 5 Slim · 2nd Ninja CREAMi · 3rd Apple AirPods Pro 3.
- **Workshop repo:** https://github.com/devfulcrum/pnc-utd-hackathon-2026 (see §6).

### 2.3 Toyota Financial Services — "What's Your Next Move?" Challenge  ← CHOSEN
- **Prompt:** help Toyota customers answer one question: *"Given my situation today, what's the smartest next move for me and my Toyota?"*
- **Four pillars:**
  - **PERSONALIZE:** use a simulated customer profile, vehicle, and loan or lease details to generate relevant insights.
  - **SIMPLIFY:** explain realistic options, payments, costs, assumptions, and trade-offs in plain language.
  - **GUIDE:** guide customers to a clear next step: self-service, a follow-up, or an eligible offer.
  - **VALUE:** show how the idea could improve retention, grow relevant revenue, or reduce service effort.
- **Expectation:** build a working prototype · prove it with synthetic data · innovate responsibly with AI · reimagine the customer experience · unlock meaningful business value.
- **Technical expectations (from mentor message):** no live Toyota APIs or production systems. Teams build their own mock APIs / backend / local data integrations. Provided CSV/JSON can be used directly. External APIs, AI models, extra datasets welcome. All data synthetic. Focus on customer experience and decision-making process.
- **Prizes:** 1st $500 Amazon GC · 2nd $350 · 3rd $150 (per team).
- **Also:** TFS Data & Technology is hiring **35 software engineer interns for Summer 2027** (areas: architecture, cybersecurity, cloud, data, DevOps, full stack, ML/AI, UI).
- **Data pack:** see §7 (20 customers, vehicles, accounts, 142 option scenarios, offers, rate sheet, value drivers, golden answers, situations, starter prompt).

### 2.4 Capital One — "Best Use of Nessie"  ← CHOSEN
- **Prompt:** "How will you reimagine banking?" Best use of Nessie, Capital One's hackathon banking API.
- **Prize:** **$300 gift cards (Giftogram) to each member of the winning team.**
- **Mentor:** David (Capital One). Message: Nessie v2 at https://v2.nessieisreal.com/ — "a mock banking API for hackathon projects. Create customers and accounts, move money, simulate fraud and stream events — hosted."
- **API detail:** see §5.

### 2.5 8090.AI — Legacy system modernization
- **Prompt:** build agents and tools that accelerate legacy system modernization. "The world runs on old software. Make it easier to understand, improve, or replace."
- **Prize:** DJI Mic Mini.
- **Context:** 8090 = AI-native "software factory" founded by Chamath Palihapitiya; $135M Series A (Salesforce-led, June 2026); product refactors legacy enterprise codebases with AI agents. Judges will be engineers who do this for a living.
- **Assessment:** probably fewest entries, but hard judges + low prize + LLM-dependent demo. Not chosen.

### 2.6 NMC² — "Keep the World Running" (data center ops)
- **Prompt:** behind every AI model, streaming service and cloud app is a data center and a team keeping it running around the clock. A missed warning, an unclear handoff, or the wrong information at the wrong time can turn a small issue into a major disruption. Build a solution that helps data center teams stay one step ahead.
- **Prizes:** 1st AirPods Max Gen 2 · 2nd Apple Watch Series 12 · 3rd Echo Show 11.
- **Assessment:** vague brief, judged on demo polish. Not chosen.

### 2.7 Winstead PC — Cyber Incident Response Dashboard
- **Prompt:** build a dashboard that acts as a "command center" during and after a cyber incident.
- **Required components:** 01 Secure and isolated (operates inside potentially compromised networks as an isolated system) · 02 Access control (admin adds individuals) · 03 Incident documentation (standards-compliant, real-time updating, status monitoring) · 04 Scope definitions (range of compromised data and its status: locked for ransomware, exfiltrated, etc.) · 05 Real-time communications within the dashboard.
- **Judging:** Security (assume attacker has access to all internal systems; dashboard must be independently secure) · Ease of use (team under stress, no tutorials; "almost as important as security") · Creativity (anything beyond objectives that enhances functionality).
- **Prizes:** 1st $1,500 · 2nd $900 · 3rd $300 per team.
- **Assessment:** was the original recommendation (rubric-based, low competition, lawyer judges). A full plan ("Breakglass") exists in `winstead_gameplan.pdf` and `breakglass_pipeline.pdf`. Set aside in favor of the fintech stack; keep as fallback.

### 2.8 Goldman Sachs — "DealPilot"
- **Prompt:** build a comprehensive platform that automates and secures the entire lifecycle of commercial loan processing, leveraging AI/ML to detect hidden, cross-deal fraud patterns and achieve operational excellence.
- **Prizes:** 1st AirPods Max 2 · 2nd HomePod Mini 2 · 3rd $50 Grubhub GC.
- **Note:** statement is marked confidential to HackUTD 2026 participants; do not share externally.
- **Assessment:** resume magnet, huge scope. Not chosen.

### 2.9 SpacetimeDB — two tracks ($5,376 total)
- **Main track:** build your project on Spacetime; Spacetime must power the app's primary functionality (not just chat or player movement). 1st $2,048 · 2nd $1,024 · 3rd $512.
- **ScrabbleBot tournament:** write a bot for their Scrabble-style sealed-bid auction game. Live competition **10:45 PM Saturday**. TypeScript starter; Rust and C# work. 1st $1,024 · 2nd $512 · 3rd $256. scrabblebot.spacetimedb.com. (At Cal Hacks the same tournament had 68 bots; winners modeled rivals and planned whole matches.)
- **Credit:** 100,000 TeV (~$38) Maincloud credit per hacker, code `HACKUTD2026`, one per GitHub account.
- **Both tracks:** public source on GitHub required to win.
- **Assessment:** not chosen.

### 2.10 CBRE — real estate data
- **Prompt:** build an application that connects fragmented real estate data to predict operational failures, quantify business impact, or execute solutions before disruptions spread.
- **Prizes:** 1st Sony headphones · 2nd Kindle · 3rd digital camera.

### 2.11 State Farm — "The Worst Day, at Scale" (Intelligent Catastrophe Response)
- **Prompt:** when a major disaster affects thousands simultaneously, how might we use AI and technology to identify those with the most urgent needs, coordinate assistance, and ensure no one is overlooked?
- **Prizes:** 1st Beats Studio Pro · 2nd RC drone with UHD camera + GPS · 3rd wireless portable monitor.

### 2.12 NVIDIA — "Use Nemotron Beyond a Chatbot"
- **Must use Nemotron, and the project must include:** beyond a chatbot (not just responding to prompts) · multi-step workflows (agents that plan and execute) · tool integration (external APIs/services) · real-world applicability.
- **Prizes:** 1st 2× RTX 5080 + $200 Brev credits · 2nd 1× RTX 5080 + $200 Brev credits + swag.
- **Note:** could be a 3rd sponsor slot alternative if Cap1 is dropped; the NextMove coach (tool-using agent) would qualify.

### 2.13 Photon — messaging/voice API
- **Requirements:** integrate Photon 2.0 beta (photon.codes/beta): texting (iMessage, SMS, RCS, WhatsApp, Telegram, Email) and voice (phone calls on an SMS number and iMessage). Must integrate the Photon 2.0 API to qualify.
- **Prizes:** Track winner $700 ($400 cash + $300 credits + fast-track interview) · runner-up $300 ($200 + $100 credits) · **Voice Call winner $400** ($300 + $100 credits).

### 2.14 MLH tracks (unlimited entries)
| Track | Prize | Link |
|---|---|---|
| Best Use of Tiger Data (scalable Postgres) | Stream Deck Mini | mlh.link/tigerdata |
| Best Use of Solana | Unruggable wallets | mlh.link/solana |
| Your Hackathon A-Team with SpaceXSI (Cursor + Grok Bot) | Mechanical keyboards | mlh.link/spacexsi (requires Cursor + a Grok Bot automation + raffle opt-in) |
| Best Domain from GoDaddy Registry | Digital gift card | mlh.link/godaddyregistry, code `MLHUTD84` |
| Best Use of Vultr | Portable screens | mlh.link/vultr |
| Best Use of MongoDB Atlas | M5GO starter kits | mlh.link/mongodb |
| Best Use of Gemini API | MLH + DEV swag bags | mlh.link/gemini |
| DEV Writing Challenge (publish your project story) | $100 | dev.to/mlh-hackathon |

---

## 3. Strategy and reasoning (decided so far)

### 3.1 Why these three tracks
- They share one product. PNC asks for the whole financial picture + next move; Toyota asks for the next move for "me and my Toyota"; Capital One asks you to reimagine banking using their bank API. One person, seen from three angles.
- Richard's domain fit: fintech, accounting/econ, consulting.
- Trade-off acknowledged: PNC and Toyota are among the most-entered tracks. The product must differentiate visibly in the first 30 seconds of the demo.

### 3.2 Differentiators (what no current platform does together)
1. **Moves, not balances.** The UI is a ranked list of concrete moves, each with a dollar impact and a click-through "why".
2. **The car is a first-class financial object.** Equity (value − payoff), lease mileage pace, lease-end date, refi eligibility — fused with full cash flow. No bank app knows the car; no auto lender knows the cash flow.
3. **Two futures on every move.** 24-month projection of "do nothing" vs "do this"; the gap is the move's value. (PNC: forecast + what-if.)
4. **Deterministic math, LLM narration.** Rules compute, LLM explains. No invented numbers. (PNC + Toyota responsible-AI requirement.)
5. **Execute in the bank.** Accepting a move posts real transactions to Nessie (transfer to savings, extra principal payment, set up autopay bill) and the projection re-runs live. With v2, the app can also approve/decline pending transactions via decision hooks. (Cap1 "reimagine banking".)
6. **Guardrails from the Toyota pack:** vulnerable customers get a human, marketing consent respected, honest "no offer" allowed.

### 3.3 Ideas from mentor conversations to integrate
- **Personas + adaptive tiles (PNC mentor discussion):** the dataset is bigger than any one customer needs. Show only tiles relevant to that customer (car tile only if there's a vehicle; mortgage tile only if a mortgage), and reorder by what matters now (lease ending → lease tile to the top). Clean, tile-based UI.
- **"AI analyze" button:** on demand, the agent analyzes the picture and produces/re-ranks moves and tiles.
- **Multi-model / multi-agent analysis + human ranking:** multiple analyses (either multiple LLMs or multiple specialized agents: budget, debt, car, risk) are generated; a human ranks them; rankings feed back to improve/weight future outputs. (Exact semantics still an open question, see §10.)
- **Markov simulations (PNC mentor mention):** working interpretation: a small Markov chain over financial-health states (healthy → strained → distressed) with transition probabilities derived from the profile; each move shifts the matrix; report "probability of stress in 12 months: 34% → 12%". Could also be a Monte Carlo cash-flow forecast (the PNC workshop lists Monte Carlo as a stretch idea). To confirm.
- **PNC workshop levels:** Level 1 plain LLM → Level 2 tool-using agent → Level 3 orchestrated (LangGraph) with validation. Workshop advice: start at 1–2, go to 3 only if justified. Responsible AI: code does arithmetic; only approved tools exposed; validate before explaining; state uncertainty; synthetic data only; "not financial advice".

---

## 4. Product spec: NextMove (current draft)

### 4.1 Screens (three, plus a persistent coach panel)
1. **Next Moves (hero):** three move cards. Each: title, dollar impact in large type ("+$2,340 by Nov 2028"), one-line why, "see the two futures" button. Tiles adapt to the persona. For a customer with a Toyota, one card is always the car move.
2. **Your Picture:** accounts grouped as PNC lists them (checking, savings, CDs/IRAs, loans, cards, mortgage), the car as its own card (equity, lease pace, Toyota Care/warranty/recall), health scorecard, 24-month baseline projection with events marked (lease end, loan payoff).
3. **Try It (what-if):** sliders — extra $/mo to a debt, buy out lease y/n, new salary, one-time expense. Chart re-runs live.
- **Coach panel:** LLM with tools (`get_profile`, `get_health`, `run_projection`, `simulate_move`, `get_car_options`, `execute_move`). Never does math.
- **TFS view toggle (Toyota "Value"):** same customer from Toyota's side: eligible offers, next-step type, expected value (from `value_drivers.csv` / `golden_answers.csv`), service effort.

### 4.2 Engine (pure functions)
- `project(profile, months=24)` → monthly simulation: income in (paycheck deposits), fixed + variable out (bills, purchases), debts amortize, interest accrues, events fire. Returns per-account arrays + net worth.
- `health(profile)` → indicators: runway months (liquid / essential spend), DTI, card utilization, savings rate, shock resilience ($1,500 surprise y/n), car equity ratio, payment-to-income, subscription burden. (PNC wants 3+; give 6–8.)
- `generateMoves(profile)` → rules produce candidate moves with an applied-profile; `impact = project(applied).netWorth[24] − project(base).netWorth[24]`; rank. Bank-side rules (pay highest APR, build runway to 3 months, idle cash to CD, cancel recurring, move due date to payday) + car-side rules **sourced from the Toyota option scenarios** (refi, extend, extra $100, due date, defer, trade, buyout, return, renew, extend lease, early end, relocate, service) filtered by `eligibility` and the guardrails.
- Optional: Markov health-state chain; Monte Carlo band on the projection.

### 4.3 Data layer
- **Nessie v2** = the bank: customers, checking/savings/credit-card accounts, deposits (paychecks), purchases + merchants, bills (recurring), loans, transactions with states, events. Seeded from the Toyota 20 customers (income → deposits on `payday_day`; `other_monthly_debt` → bills; loan/lease → Nessie loan; `autopay` → recurring bill). Optional: run the simulator in `historical` mode for 30 days of realistic transaction history with anomalies.
- **Toyota data pack** = the vehicle, the contract, the precomputed options, the offers, the guardrails, the golden answers (for a "matches TFS reference" check).
- **Local JSON** = anything neither has (e.g., persona tile config).
- **Cache + fallback:** cache the normalized profile in localStorage; if Nessie errors, flip to the cached snapshot with a small "offline snapshot" badge. The demo must never depend on sponsor API uptime.

### 4.4 Proposed stack (default; open question)
- Next.js UI (React, Recharts) + small Python FastAPI service wrapping the PNC `wellness` package (metrics/forecast/scenarios) **or** engine in TypeScript only. Coach via whichever LLM key is available (Gemini free tier also earns the MLH Gemini track; Nemotron would earn the NVIDIA track if that slot is used).
- Deploy on Vultr (MLH), domain from GoDaddy (MLH). Public HTTPS enables Nessie decision hooks/webhooks; without it, poll `GET /events` and call `POST /transactions/{id}/decision` directly.

### 4.5 Demo script (3 minutes)
Pick a persona (e.g., C003 Priya: lease ends in 3 months, over mileage). Show the picture → health scorecard → three moves with the car move on top → two futures chart → accept a bank move → Nessie transfer posts, event feed shows it, projection re-runs → coach explains in plain language → TFS view toggle shows offer eligibility + expected value → persona switch to a vulnerable customer (C014) to show the guardrail: no upsell, human handoff.

### 4.6 Build order (default, ~20 h)
| Hours | Work |
|---|---|
| 0–1 | Devpost placeholder, Nessie key, `curl /health`, repo, scaffold |
| 1–3 | Seed script: Toyota customers → Nessie (customers, accounts, deposits, bills, loans, merchants); `fetchProfile` + normalizer |
| 3–6 | Engine: `project`, `health`, 6 bank rules + Toyota option ingestion, ranking |
| 6–10 | Hero screen + two-futures chart (make it beautiful first) |
| 10–12 | Execute-in-Nessie path with live re-fetch; event feed poll |
| 12–14 | Your Picture + scorecard + car card + adaptive tiles |
| 14–16 | Coach with tools; "AI analyze" button |
| 16–17 | TFS view toggle; guardrails (vulnerable / consent) |
| 17–19 | What-if sliders; persona switcher; polish; deploy; domain |
| 19–21 | Video, README, Devpost, pitch |
Cut order if behind: TFS toggle → extra personas → what-if sliders → human-ranking loop. Never cut: hero, two futures, the car move, execute-in-Nessie.

---

## 5. Capital One — Nessie v2 API reference (from v2.nessieisreal.com docs)

- **Base URL:** `https://v2-prod-api.nessieisreal.com`
- **Health:** `GET /health` (public)
- **Auth:** `Authorization: Bearer nsk_...` header (keys never accepted in query string). Get a key at https://v2.nessieisreal.com/account. Docs at https://v2.nessieisreal.com/docs (Scalar, client-rendered); spec at `/openapi.yaml` and `/openapi.json`.
- **Rate limit:** 120 req/min per key, bursts of 30; `RateLimit-Limit` / `RateLimit-Remaining` headers; 429 with `Retry-After`. Polling the event feed every 1–2 s is fine.
- **Tenancy:** other keys' resources return 404.

### Endpoints
- **Customers:** `GET/POST /customers`, `GET/PATCH/DELETE /customers/{id}`
- **Accounts:** `GET/POST /accounts` (paged `cursor`/`limit`), `GET/PATCH/DELETE /accounts/{id}` (PATCH nickname or credit limit), `GET/POST /customers/{id}/accounts`, `GET /accounts/{id}/customer`
  - Types: `Checking`, `Savings` (debit needs available funds), `Credit Card` (debit needs available credit; `balance_cents` = amount owed; credit limit default 100000 cents = $1,000; limit only valid on cards). `available_cents` = balance − holds (or remaining credit).
- **Transactions (money movement):** `POST /accounts/{id}/deposits`, `/withdrawals`, `/transfers` (to `payee_id`), `/purchases` (from `merchant_id`), `/fees`, `/interest`, `/refunds` (optional `parent_transaction_id`), `/chargebacks` (may go negative); `GET /accounts/{id}/transactions` (newest first, `limit` ≤ 5000, no cursor); `POST /bills/{id}/payments` (optional `amount_cents`, `medium`: `balance` | `rewards`).
  - Referenced in guides: `GET /transactions`, `POST /transactions/{id}/decision`, `POST /transactions/{id}/cancel`, `POST /transactions/{id}/settle`.
  - **States:** created as `pending` → `completed` | `declined` | `cancelled`. Pending holds funds (refunds/chargebacks take no hold). Card transactions stay pending ~60 s by default, others ~10 s. Before settling you can cancel, decide, or settle early.
  - **Kinds:** deposit, withdrawal, transfer, purchase, bill_payment, fee, interest_credit, refund, chargeback.
- **Bills:** `GET/POST /bills`, `GET/POST /accounts/{id}/bills`, `GET/PATCH/DELETE /bills/{id}`. Create requires `status` (`pending` | `cancelled` | `completed` | `recurring`), `payee`, `payment_amount` (dollars); optional `nickname`, `payment_date`, `recurring_date` (1–31).
- **Loans:** `GET/POST /loans`, `GET/POST /accounts/{id}/loans`, `GET/PATCH/DELETE /loans/{id}`. Create requires `type`, `status`, `credit_score` (300–850), `monthly_payment_cents`, `amount_cents`, `description`; response adds `id`, `account_id`, `creation_date`, timestamps.
- **Merchants:** `GET/POST /merchants`, `GET/PATCH/DELETE /merchants/{id}`
- **ATMs / Branches (shared, read-only):** `GET /atms`, `GET /atms/{id}`, `GET /branches`, `GET /branches/{id}`
- **Events:** `GET /events` with `after` (sequence number cursor), `types` (comma-separated), `account_id`, `limit` (default 100, max 500). Response `{items, next_cursor}`; pass `next_cursor` back as `after`. Empty page includes `Retry-After`. Types: `transaction.created`, `transaction.pending`, `transaction.declined`, `transaction.completed`, `transaction.cancelled`, `account.balance_changed`, `bill.paid`, `simulation.started`, `simulation.ended`.
- **Webhooks:** `POST /webhooks` (also `GET /webhooks/{id}/deliveries`, `POST /webhooks/{id}/ping`).
  - **Notify mode:** Nessie POSTs matching events to your URL (`events` filter, optional `account_id`).
  - **Decision mode:** register with `mode: "decision"`, `url`, `kinds` (one decision hook per kind per key). Your endpoint can (1) return 200 with approve/decline immediately, (2) return 202 + `Retry-After` and Nessie re-calls up to 10 times within `max_wait_seconds` (≤ 300), or (3) decide out of band via `POST /transactions/{id}/decision`. On hook failure: 3 retries then `on_error` (default approve; `decline` = fail closed). `decision_source` ∈ `owner` | `hook` | `on_error`.
  - Security: `Nessie-Signature` (HMAC-SHA256 over timestamp + body) and `Nessie-Event-Id`; verify and de-dupe (at-least-once delivery). Destinations must be public `https`; private/loopback/metadata addresses refused.
- **Simulator:** `POST /simulations`, `GET /simulations`, `GET/DELETE /simulations/{id}`. Modes: `historical` (past 30 days, cheap, includes failed attempts) and `live` (settles in real time with hooks/webhooks; one live run at a time). Params: `customers` (default 3, ≤ 200), `transactions` (historical only, ≤ 10,000), `anomaly_rate` (0–1, default 0.05), `scenarios`, `seed`, `rate_per_minute`, `duration_seconds`. Scenarios: `card_testing`, `velocity_spike`, `geo_distant`, `large_transfer_new_payee`, `account_takeover`, `structuring`, `unusual_category`, `foreign_atm_cashout`. Data includes disputes (refund/chargeback linked to parents), failed attempts, fees, interest, merchant descriptors. **Nothing is labeled as fraud.** Same `seed` + `customers` reproduces a run. (Open question: whether the simulator uses existing customers or creates its own.)
- **Data:** `POST /data/seed` (demo bank: 2 customers, 4 accounts incl. a credit card, merchants, bills, a loan; no-op if key already has data), `POST /data/export` (one CSV per table, links valid 48 h), `DELETE /data` (wipe everything under your key incl. webhooks and simulations).
- **Admin routes** exist (`/admin/tenants…`) — admin role only; ignore.

### Old Nessie (v1) for reference
`api.nessieisreal.com` / `api.reimaginebanking.com`: key as query param; resources Customer, Accounts, Bill, Deposit, Loan, Purchase, Merchant, Transfer, Withdrawal, ATM/Branch. Python SDK: github.com/nessieisreal/nessie-python-sdk. **Use v2, not v1.**

---

## 6. PNC — workshop repo and mentor notes

- **Repo:** https://github.com/devfulcrum/pnc-utd-hackathon-2026 (Apache-2.0). Supports the "PNC Financial Wellness AI challenge."
- **Structure:** `Lab_Package/`, `docs/WORKSHOP.md` (60-min guide), `tests/`, `wellness/`, `requirements.txt`.
- **`wellness/` package:** synthetic data generator (`python -m wellness.data_gen -n 5 -o customers.json`), unified profile (`profile.py`), health metrics (`metrics.py`, 8 indicators, workshop asks you to add a 9th such as subscription burden), forecast module (`tools.forecast_balances`), scenario simulator (`tools.simulate_car_purchase`: amortization + cash-flow), agent tools, LLM adapters (`mock` offline, Ollama open-weight, OpenAI), Level 1–3 agents, LangGraph orchestration (`graph.level3`, plain-Python fallback). CLI: `python -m wellness.cli --level 3 "If I buy a $30,000 car with $5,000 down, will I have enough for emergencies?"`. Tests: `python -m pytest`.
- **Levels:** L1 one LLM gets the data and answers (fast, risks wrong math) · L2 LLM selects approved Python tools to fetch evidence and compute · L3 orchestrated workflow with shared state, conditional routing, validation, possibly multiple agents (critic).
- **Responsible AI (their words, paraphrased):** code performs arithmetic, LLM explains; only approved tools exposed; validate output before explaining; state uncertainty and missing data; synthetic data only; not financial advice.
- **Stretch ideas listed:** Streamlit chat UI, LangGraph multi-agent with a critic, debt-payoff simulator, anomaly/subscription detection, Monte Carlo forecast.
- **Mentor conversation (Richard):** personas; show only what matters for that customer (tile UI, e.g., car tab only if the customer has a car); an "AI analyze" button; multi-modular/multi-model analysis with human ranking of AI responses to improve them; mentor mentioned **Markov simulations** (exact meaning TBD).
- **PNC provided (per mentor):** loan and lease account information; financing options, rates, eligibility scenarios; reference AI recommendations and responsible AI guidelines. Teams may use whatever supports their solution.

---

## 7. Toyota Financial Services — "Smartest Next Move" data pack

All synthetic. "Today" in the dataset is **2026-11-07**. Rates, fees, loyalty rules are made-up and marked as assumptions.

### 7.1 Files
| File | Contents |
|---|---|
| `data/customers.csv` | 20 DFW customers |
| `data/vehicles.csv` | one Toyota each |
| `data/accounts.csv` | 15 loans + 5 leases |
| `data/situations.csv` | each customer's "today" in their words + context summary |
| `data/option_scenarios.csv` | 142 precomputed options |
| `data/offers_catalog.csv` | 14 offers with eligibility, next-step type, business value |
| `data/rate_sheet.csv` | synthetic APRs by credit tier and term |
| `data/value_drivers.csv` | dollar assumptions for revenue, retention, cost-to-serve |
| `data/golden_answers.csv` | reference best next move per customer, for judging |
| `customer_profiles.json` | all of the above joined per customer (LLM/app ready) |
| `toyota_next_move_data_pack.xlsx` | same tables as one workbook |
| `starter_system_prompt.txt` | starting prompt with responsible-AI rules |

### 7.2 Schemas (exact column headers)
- **customers.csv:** `customer_id, payday_day, first_name, age, city, state, occupation, annual_income, credit_tier_at_origination, credit_tier_now, other_monthly_debt, tenure_months_with_tfs, autopay, digital_engagement, preferred_channel, marketing_consent, vulnerable_flag, payment_to_income_pct, debt_to_income_pct, financial_stress_score`
- **vehicles.csv:** `vehicle_id, customer_id, model_year, model, trim, condition_at_purchase, purchase_price_or_msrp, odometer_now, annual_miles_est, est_market_value_now, toyota_care_ends, basic_warranty_ends, last_service_date, next_service_due, open_recall`
- **accounts.csv:** `account_id, customer_id, vehicle_id, contract_type, contract_start, term_months, months_elapsed, months_remaining, contract_end, missed_payments_12m, autopay, amount_financed, apr, money_factor, monthly_payment, current_balance, payoff_quote, residual_value, mileage_allowance_total, est_equity, payment_due_day`
- **situations.csv:** `situation_id, customer_id, customer_says, context_summary`
- **option_scenarios.csv:** `customer_id, option_id, option_name, new_monthly_payment, monthly_payment_change, upfront_cost, total_cost_vs_keep_as_is, eligibility, plain_language_summary, key_assumption, tradeoff`
  - `option_id` values: loans: `KEEP, REFI, EXTEND, EXTRA100, DUEDATE, DEFER, TRADE, SERVICE`; leases: `RETURN, BUYOUT, RENEW, EXTENDLEASE, EARLYEND`, plus `RELOCATE` (C010).
  - `eligibility` values seen: `Y`, `N (reason…)`, `Review`, `Caution (negative equity)`.
- **offers_catalog.csv:** `offer_id, offer_name, next_step_type, eligibility_rule_summary, business_value, service_effort`. Offers: REFI, EXTEND, EXTRA100, DUEDATE, DEFER, AUTOPAY, PAYOFF, TRADE, BUYOUT, RENEW, RETURN, RELOCATE, SERVICE, HUMAN. `next_step_type` ∈ Offer | Self-service | Follow-up (specialist).
- **rate_sheet.csv:** `credit_tier, tier_label, term_months, new_purchase_apr, refinance_apr`. Tiers A Super Prime (720+), B Prime (660–719), C Near Prime (600–659), D Subprime (<600); terms 36/48/60/72. Refi APR examples: A 5.6–6.5, B 7.4–8.3, C 11.1–12.0, D 15.9–16.8.
- **value_drivers.csv:** `driver_id, description, assumption_text, value_usd, value_type`. VD_CALL $9.50 avoided call · VD_DIGITAL $0.60 · VD_REFI $420 retained loan · VD_ORIG $1,800 new contract · VD_BUYOUT $1,100 · VD_SERVICE $85 · VD_AUTOPAY $18/yr · VD_CURE $1,250 · VD_CLEAR $150.
- **golden_answers.csv:** `customer_id, best_next_move, next_step_type, offer_id, plain_language_message, why_not_the_others, guardrail_notes, value_driver_ids, value_if_completed_usd, assumed_take_rate, expected_value_usd`.

### 7.3 Rules baked into the pack
- Loans use standard amortization. Leases use depreciation + rent charge (money factor); taxes/registration excluded.
- Lease: `payoff_quote` = residual + remaining payments; `est_equity` = market value − (residual + $350 buyout fee). Excess mileage $0.25/mile; $395 disposition fee; loyalty renewal waives turn-in fee and mileage charge (cap $1,500 waived); early termination ≈ 35% of remaining payments + fee.
- **Refinance eligibility:** 12+ months left, balance ≥ $8,000, no missed payments in 12 months, LTV ≤ 125%, rate drop ≥ 1.0 point.
- `financial_stress_score` (0–100) blends payment-to-income, missed payments, no autopay, vulnerable flag. Demo signal only.
- Due-date change allowed once per 12 months. One deferral per 12 months, specialist review.

### 7.4 Starter system prompt (verbatim, provided by Toyota)
```
You are the Toyota Financial Services "Next Move" assistant. A customer describes their situation today. You are given their profile, vehicle, contract, and a list of precomputed options (customer_profiles.json).

Rules:
1. Use ONLY the numbers in the provided options. Never invent rates, payments, or eligibility.
2. Explain in plain language at an 8th-grade reading level. No jargon without a one-line definition.
3. Recommend ONE best next move, then name one or two alternatives and the trade-off of each (cost now vs cost later).
4. State assumptions out loud (rate source, estimated vehicle value, taxes excluded).
5. End with exactly one clear next step labeled: Self-service, Follow-up, or Eligible offer.
6. If vulnerable_flag = Y, or missed_payments_12m >= 2, or the customer sounds distressed: no upsell, no marketing, offer a human specialist.
7. If marketing_consent = N, do not present new-vehicle offers.
8. If no offer is eligible, say so honestly and say when to re-check.
9. Never give legal, tax, or credit-repair advice. All data here is synthetic.
```

### 7.5 Responsible AI checklist (Toyota)
1. Numbers come from the data (no invented rates/payments). 2. Assumptions stated plainly. 3. Vulnerable/distressed → a person, not a pitch. 4. Marketing consent respected. 5. Trade-offs shown. 6. "No eligible offer" is an allowed answer. 7. No real personal data.

### 7.6 Customer roster (id · name · contract · situation → golden answer)
| ID | Name | Contract | Situation (short) | Golden next move (type) |
|---|---|---|---|---|
| C001 | Maya, 23 | loan 12.9%, 43 mo left, neg equity −$221 | new job, credit improved D→B, "am I overpaying?" | REFI at 7.70% (Offer) |
| C002 | Carlos, 41, vulnerable | loan 7.4%, 1 missed pmt | hours cut, late last month, wants to keep Camry | DEFER + due date via specialist (Follow-up); no upsell |
| C003 | Priya, 34 | lease, 3 mo left, 49.5k vs 36k mi | over mileage, "what's cheapest?" | BUYOUT ($16,670 vs value $18,600) (Offer) |
| C004 | James, 46 | loan 5.9%, equity $5,535 | wants a Tundra | TRADE (Offer) |
| C005 | Linda, 58 | loan, 6 pmts left, equity $18k | mails a check | AUTOPAY + payoff quote (Self-service), no pitch |
| C006 | Devon, 29 | lease, 5 mo left, low miles, equity $4,100 | turn in, buy, or new? | RENEW early into new hybrid (Offer) |
| C007 | Aisha, 33 | loan, equity $1,753 | baby coming, Prius too small | TRADE to Sienna, check PTI ≤ 15% (Offer) |
| C008 | Tom, 52 | loan 10.9%, 48 mo, tier C→A | rate bugs him | REFI to 5.9%, saves $4,281 (Offer) |
| C009 | Sofia, 27 | loan | service overdue, Toyota Care ending, open recall | SERVICE + recall (Self-service), safety first |
| C010 | Ryan, 36 | lease, 18 mo left | moving to Denver | RELOCATE lease (Follow-up) |
| C011 | Grace, 68, vulnerable, consent N | loan, 10 pmts left | wants a person, phone only | HUMAN call: payoff timeline + optional autopay (Follow-up); no offers |
| C012 | Marcus, 39 | loan 9.4%, 57 mo, neg equity −$5,204 | wants to sell, underwater | REFI to 7.9%, revisit selling later (Offer) |
| C013 | Nina, 31 | lease bZ4X, 6 mo left, equity $8,790 | EV vs hybrid | RENEW: compare buyout / EV renewal / hybrid (Offer), stay neutral |
| C014 | Kevin, 44, vulnerable, 2 missed | loan 13.2%, tier C→D | missed two, "can't lose my truck" | HUMAN hardship specialist today (Follow-up); no upsell |
| C015 | Elena, 37 | loan 5.9%, 42 mo | extra cash monthly | EXTRA100 (Self-service) |
| C016 | Omar, 25, vulnerable | loan 17.9%, 70 mo, neg equity −$3,815, LTV >125% | underwater, high rate | AUTOPAY, honest "no offer", re-check in 6 mo (Self-service) |
| C017 | Hannah, 43 | lease, 2 mo left, equity $5,250 | wants to keep Highlander | BUYOUT with TFS financing (Offer) |
| C018 | Brian, 30 | loan, due 1st, paid 15th | overdraft fees | DUEDATE to the 15th (Self-service) |
| C019 | Tasha, 40 | loan 8.9%, 53 mo, neg equity −$458 | budget squeeze, payment heavy | REFI (−$25/mo, −$1,320) with EXTEND as backup (Offer) |
| C020 | Victor, 48 | loan, 8 pmts left, equity $11,336 | trade early or wait? | PAYOFF: wait, then upgrade (Self-service) |

### 7.7 Suggested test cases (from README)
C001/C008 finds a refinance and explains savings · C002/C014 switches to a human and does not upsell · C003/C006/C017 compares buyout vs return vs renewal · C012/C016 is honest about negative equity / no offer · C009 leads with safety (recall) · C018 picks the simple self-service fix · C005/C020 avoids pushing a product when waiting is best · C011 respects phone-only, no-marketing.

---

## 8. Mentor messages (verbatim-ish)

**David, Capital One:** "Capital One's sponsor challenge this year is best use of Nessie (our banking API) https://v2.nessieisreal.com/. The prize for winning our track is $300 in rewards per winning teammate. Nessie is a mock banking API for hackathon projects. Create customers and accounts, move money, simulate fraud and stream events — hosted."

**Toyota (development & technical expectations):** no live Toyota APIs or production systems; teams create their own mock APIs/backends/local data integrations; provided CSV/JSON can be integrated directly; external APIs, AI models, additional datasets welcome; all customer/financial info synthetic; focus on a working prototype that demonstrates the customer experience and decision-making process.

**PNC workshop mentor (Richard's notes):** showed the repo; discussed personas, relevance-filtered tile UI (car tab only if there is a car), an AI-analyze button, a multi-modular approach so the AI can analyze from multiple angles, human ranking of AI responses to improve them, and "Markov simulations."

---

## 9. Files produced so far in this planning session
- `winstead_gameplan.pdf` (3 pages): the original Winstead-track plan, booth questions, why-not analysis.
- `breakglass_pipeline.pdf` (1 page, landscape): Winstead project architecture + 7-step pipeline + wireframe/data model.
- This file: `HACKUTD_2026_CONTEXT.md`.
- Toyota data pack files are attached in the chat (CSV/JSON/XLSX/txt listed in §7.1).

---

## 10. Open questions (answer these before building; defaults in brackets)
1. Team: still solo? If someone joined, what can they do? [solo]
2. Current time and realistic coding hours before noon. [~20 h]
3. Frontend/stack: Next.js + small Python FastAPI wrapping the PNC `wellness` package, or TypeScript-only engine, or Streamlit? [Next.js + FastAPI wrapper]
4. LLM keys available (OpenAI / Gemini / NVIDIA NIM Nemotron / Anthropic / Ollama) and which is primary. [Gemini free tier → also MLH Gemini track]
5. Public HTTPS tonight (Vultr + domain)? Needed only for Nessie decision hooks/webhooks. [poll `GET /events` + manual `POST /transactions/{id}/decision`; add hooks if deployed by hour 12]
6. "Multi-modular approach": multiple LLMs, multiple specialized agents, or both? "Rank the AI response as human": end-user thumbs/ranking, or a reviewer/critic step? What does the ranking change? [specialized agents (budget, debt, car, risk) + user ranking that re-weights the move order and is stored per persona]
7. Markov: what exactly did the PNC mentor mean? [health-state Markov chain: healthy/strained/distressed, transition matrix from profile, each move shifts it; report P(stress in 12 mo) before/after]
8. Persona tiles rule: "show only if data exists" and/or "reorder by what matters now"? [both; AI-analyze re-orders]
9. Use the Toyota 20 customers as THE personas across PNC/Cap1/Toyota, seeded into Nessie by script? [yes]
10. Did David say what "best use of Nessie" means to judges (breadth / v2 features / product quality), and is fraud detection expected? [assume: v2 features + write path; fraud tile optional]
11. Toyota brain: use starter prompt + golden answers nearly verbatim, or feed option scenarios into our ranking engine? [their options + their guardrails, our ranking + explanation, plus a "matches TFS reference answer" check]
12. Priority order for: fraud/anomaly tile (simulator), decision hooks (live approve/decline), what-if sliders, human-ranking loop. [solo can guarantee two]
