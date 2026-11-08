# Demo video script (target 2:50, hard cap 3:00)

## Setup before recording
- **Record on the newest build.**
  - If the teammate has redeployed, use **https://www.one-flow.us**. Check that `/api/history/C018` returns `"ok":true` and that the bell shows two swipe buttons.
  - Otherwise use `pnpm dev` on localhost.
- Browser at 1440×900, light mode, zoom 100%, bell closed.
- Tabs ready:
  - `/?p=C003` (Priya)
  - `/car?p=C003&tab=tfs&view=portfolio`
  - `/?p=C018` (Brian)
  - `/what-if?p=C018`
  - `/?p=C014` (Kevin)
  - `/accounts?p=C018`
- Do **not** seed or simulate on recording day (it floods Nessie and settlement lags).
- **Every take moves real Nessie money.**
  - Brian's card needs ≥ $1,600 available for the two $800 swipes; his hero move *Pay card now* (in the script) adds room.
  - Do one dry run, then record.
  - Never use Priya (C003) for money moves.
- Profiles cache for 15 s; after a money move the app refreshes itself. If a number looks stale, wait 2 s or press Refresh on Accounts.

## Script
| Time | Screen | Say (roughly) | Track |
|---|---|---|---|
| 0:00–0:12 | Overview, Priya | "Your bank doesn't know your car, and your car lender doesn't know your bank. NovaBank knows both, and answers one question: what's my next best move?" | all |
| 0:12–0:32 | Hero: *Buy the car at lease end*, **✓ matches Toyota's reference** | "Priya's lease ends in three months. Our engine (plain TypeScript, no AI) ranks every option by where she ends up in 24 months. Buying out wins by about $8,958, and it matches Toyota's own reference answer. That badge is computed, not hard-coded." | Toyota, PNC |
| 0:32–0:50 | *Why this?* → two futures → **AI analyze** | "Do nothing versus do this. The AI coach explains the engine's numbers in plain language, but it isn't allowed to do math." | PNC, Gemini |
| 0:50–1:10 | Car → **TFS view** → **Portfolio · all customers** | "Now Toyota's side, across all 20 customers. Our top move matches their reference answer for 11. That carries $2,278 of the expected value. Seven finish in self-service, four vulnerable customers go to a person, and six sales offers are held back by code-enforced guardrails." | Toyota (VALUE) |
| 1:10–1:30 | Brian: hero **Pay card now** → bell → event feed shows it settle. Then Day-to-day → **Send money** → Linda, $5 → Review → **Confirm send** → receipt with the Nessie tx id | "Every move is real. That payment just moved money in Capital One's Nessie bank, and you can watch it settle. Brian can also pay a friend: a real Nessie transfer, checked for ownership and balance, with the bank's own transaction id." | Capital One |
| 1:30–1:55 | Bell → **Simulate $800 swipe at Target** (approved) → **Simulate $800 casino charge** (declined: *Blocked category: gambling*) | "NovaBank decides card holds before they settle, using Nessie's pending-transaction decisions. Target fits his budget, so it's approved. A casino charge hits a blocked category, so it's declined, and the bank releases the hold." | Capital One |
| 1:55–2:15 | **What if** → preset *Lose $1,000/mo* | "What if Brian lost $1,000 a month? The same engine replays his next 24 months: he runs out of cash in month 17, pays $280 in overdraft fees, and these health indicators get worse. Computed, not guessed." | PNC (what-if) |
| 2:15–2:30 | Switch to Kevin: one card, *Talk to a hardship specialist today* | "Kevin is flagged vulnerable with two missed payments, so he gets a person, not a pitch." | Toyota (responsible AI) |
| 2:30–2:45 | Accounts → **Balance history** (Tiger Data). Quick pan of the mobile layout | "Every bank event streams into a TimescaleDB time series on Tiger Data, so Brian sees real balance history the bank itself doesn't give. And it all works on a phone." | Tiger, Design |
| 2:45–2:55 | Overview, `www.one-flow.us` in the address bar | "NovaBank at one-flow.us: the code computes, the AI explains, the bank executes." | GoDaddy |

## Fallbacks
- **Coach slow:** the chain falls back from Gemini to OpenRouter to the offline narrator automatically. Keep talking.
- **Swipe fails with "not enough available credit":** run *Pay card now* first, then retry.
- **Nessie slow (rare):** wait 10 s. The 15 s profile cache keeps pages fast, and the offline badge is honest if it ever shows.
- **Solana segment:** if the teammate's Solana feature is merged, add a 10 s beat after Send money (devnet tx + explorer link). Trim the Kevin beat to 10 s to stay under 3:00.
