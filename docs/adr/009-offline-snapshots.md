# ADR-009: Offline snapshot per persona committed to the repo

**Status:** accepted · 2026-11-07

## Decision
scripts/snapshot.ts writes a normalized Profile per seeded persona; UI falls back to it with an 'offline snapshot' badge.

## Why
Demo must never depend on sponsor API uptime.

## Consequences
Snapshots can go stale after executing moves; badge makes that visible.
