# ADR-012: Nessie event history in Tiger Data (TimescaleDB)

**Status:** accepted · 2026-11-08 · amends ADR-004

## Decision
Store every Nessie event in a Tiger Data (TimescaleDB) hypertable, `nessie_events`, partitioned by `created_at`. A continuous aggregate, `account_balance_15m`, gives each account's last balance per 15-minute bucket via `time_bucket` + `last()`, refreshed every 5 minutes, with real-time aggregation for the newest rows. The Accounts page charts it via `/api/history/[persona]`.

Nessie stays the system of record (ADR-004). Tiger holds a read-only time-series copy.

## Why
Nessie only reports current balances. Its `account.balance_changed` events carry the new balance, so storing the event stream gives a real, per-account balance history. That is a time-series problem, which is what TimescaleDB is for.

## How data gets in
- `pnpm tiger:setup` creates the schema. It is idempotent.
- `pnpm tiger:backfill` copies history, resuming from the highest stored `seq`.
- After that, the shared event poller (`/api/events`) writes every page it reads. Inserts are `ON CONFLICT DO NOTHING`, and a database failure never breaks the live feed.

## TLS
Tiger signs service certificates with a private root (`CN=ca.timescale.com`). Node and the OS trust store do not include it. We pin that CA in `src/lib/tiger/ca.ts` and keep full verification (chain + hostname); we never disable certificate checks.

## Consequences
- History starts when the accounts were opened in Nessie (the seed run on 2026-11-07, evening CST), not months back.
- Without `DATABASE_URL`, the history panel is hidden and nothing else changes.
