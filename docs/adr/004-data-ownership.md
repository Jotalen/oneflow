# ADR-004: Nessie is the bank system of record; Toyota CSV is read-only; app state in localStorage + committed snapshots

**Status:** accepted · 2026-11-07

## Decision
No database.

## Why
No time for a DB in 20h; nothing in app state must outlive the demo browser.

## Consequences
Tile order and rankings do not persist across browsers. Snapshots in data/snapshots make the demo survive a Nessie outage.
