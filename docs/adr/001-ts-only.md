# ADR-001: TypeScript-only, one Next.js process

**Status:** accepted · 2026-11-07

## Decision
Engine, API proxy and UI live in one Next.js 15 App Router app. No Python service.

## Why
Solo builder, 20h, one deploy target.

## Consequences
PNC wellness repo is reference only; its 8 metric names/definitions are mirrored in src/lib/engine/health.ts and credited in README and docs/pnc-parity.md.
