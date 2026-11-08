# ADR-006: Integer cents everywhere; convert at boundaries

**Status:** accepted · 2026-11-07

## Decision
Engine and Nessie payloads use integer cents. Toyota dollars convert on load. Exception: Nessie bills.payment_amount is dollars (confirmed in OpenAPI) and converts only inside the client wrapper.

## Why
Nessie v2 is cents; Toyota is dollars; floats in money math are a credibility risk.

## Consequences
src/lib/money.ts owns toCents/toDollars/fmtUSD. No floats in engine.
