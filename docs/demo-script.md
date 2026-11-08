# Demo video script (target 2:45, hard cap 3:00)

Setup before recording:
- `npm run dev`, browser at 1440×900, light mode, bell closed, zoom 100%.
- Tabs ready: `/?p=C003` (Priya), `/?p=C018` (Brian), `/?p=C014` (Kevin).
- Do **not** seed or simulate on recording day (it floods Nessie and settlement lags).
- Brian's card needs at least $1,600 available for two $800 swipes. Check the Accounts page; if low, use *Pay card now* first.
- Do a dry run of the casino swipe once. Each take uses real Nessie money.

| Time | Screen | Say (roughly) |
|---|---|---|
| 0:00–0:15 | Overview, Priya | "Your bank doesn't know your car, and your car lender doesn't know your bank. NovaBank knows both, and answers one question: what's my next best move?" |
| 0:15–0:40 | Hero card: *Buy the car at lease end*, **✓ matches Toyota's reference**. Scroll the bubbles. | "Priya's lease ends in three months. Our engine (plain TypeScript, no AI) ranks every option by where she's better off in 24 months. Buying out wins by about $8,958, and it matches Toyota's own reference answer. That badge is computed, not hard-coded: 11 of 20 customers match." |
| 0:40–1:05 | *Why this?* → two-futures chart → press **AI analyze** in the coach. | "Do nothing versus do this. The AI coach explains the engine's numbers in plain language, but it is not allowed to do math. Every figure comes from Toyota's data or the bank." |
| 1:05–1:20 | Car page → **My lease** tab, then **TFS view** tab. | "For Toyota: payments, total cost versus keeping as-is, the trade-off, a clear next step, and the business value of this customer completing it." |
| 1:20–1:40 | Switch to Brian (avatar menu). Hero: *Put $…/mo extra toward Rewards Card* → **Pay card now** → open the bell, the event feed shows it settle. | "Every move is real. That button just moved money in Capital One's Nessie bank, and you can watch it settle live." |
| 1:40–2:15 | Bell → **Simulate $800 swipe at Target** (approve) → **Simulate $800 casino charge** (decline, *Blocked category: gambling*). | "NovaBank decides card holds before they settle, using Nessie's pending-transaction decisions. Target fits his budget, so it's approved. A casino charge hits a blocked category, so it's declined, and the bank releases the hold." |
| 2:15–2:35 | Switch to Kevin. One card: *Talk to a hardship specialist today*. No offers. | "Kevin is flagged vulnerable with two missed payments. So he gets a person, not a pitch. Guardrails are enforced in code, not in a prompt." |
| 2:35–2:50 | Quick pan: Budget, Net worth, Safety net, Credit (estimate label), mobile tab bar. | "One clear view of everything, built from our own wireframes, with 8 health indicators from PNC's workshop." |
| 2:50–3:00 | Overview again. | "NovaBank: the code computes, the AI explains, the bank executes." |

Fallbacks:
- If the coach is slow, the chain falls back from Gemini to OpenRouter to the offline narrator automatically. Keep talking.
- If Nessie rate-limits (rare), wait 10 s. The profile reloads from cache, and the offline badge is honest about it.
