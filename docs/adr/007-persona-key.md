# ADR-007: Toyota customer_id is the persona key

**Status:** accepted · 2026-11-07

## Decision
data/seed-ids.json maps C0xx to Nessie ids. Reset deletes by stored ids. DELETE /data is never called by the app.

## Why
Three sponsor tracks must see the same 20 people.

## Consequences
Re-seed with --force overwrites the mapping for that persona only.
