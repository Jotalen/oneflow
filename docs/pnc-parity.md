# PNC wellness parity

Reference: https://github.com/devfulcrum/pnc-utd-hackathon-2026 (`wellness/metrics.py`, 8 indicators; workshop asks for a 9th such as subscription burden). We reimplement in TypeScript; names below map theirs to ours. Filled in Task 4.

| # | PNC indicator (reference) | Ours (`src/lib/engine/health.ts`) | Definition used here |
|---|---|---|---|
| 1 | emergency runway | `runwayMonths` | liquid (checking+savings+CD) ÷ essential monthly spend |
| 2 | debt-to-income | `dtiPct` | all monthly debt payments ÷ gross monthly income × 100 |
| 3 | credit utilization | `utilizationPct` | card balances ÷ card limits × 100 |
| 4 | savings rate | `savingsRatePct` | (income − all outflows) ÷ income × 100 |
| 5 | shock resilience | `shockResilient` | liquid ≥ $1,500 |
| 6 | asset/equity position | `carEquityRatio` | est. equity ÷ market value (null without a vehicle) |
| 7 | payment-to-income | `ptiPct` | vehicle payment ÷ gross monthly income × 100 |
| 8 | discretionary / subscription burden (9th) | `subscriptionBurdenPct` | recurring streaming/phone/gym bills ÷ income × 100 |
