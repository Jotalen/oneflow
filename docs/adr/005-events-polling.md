# ADR-005: Poll /events first; decision-mode webhook only after HTTPS deploy

**Status:** accepted · 2026-11-07

## Decision
Pending-transaction guard polls GET /events every 2s and decides via POST /transactions/{id}/decision. Webhook registered only if https://<domain>/api/health is live.

## Why
Webhooks require a public HTTPS URL; polling delivers 90% of the demo without it.

## Consequences
decision_source reads owner until upgraded; README states which mode shipped.
