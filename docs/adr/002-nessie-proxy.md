# ADR-002: Server-side Nessie proxy with token-bucket rate limiter

**Status:** accepted · 2026-11-07

## Decision
Browser never calls Nessie. All calls go through src/lib/nessie/client.ts from server routes and scripts. One token bucket: 120 req/min, burst 30, honor Retry-After on 429.

## Why
Bearer key must never reach the browser; one authority for the rate limit.

## Consequences
Seed script and app share the same client module and therefore the same budget. Never seed during the demo.
