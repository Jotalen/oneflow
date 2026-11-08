# ADR-008: Fraud tile is a bank-wide monitor over simulator accounts

**Status:** accepted · 2026-11-07

## Decision
POST /simulations creates its own synthetic customers (OpenAPI: 'How many synthetic customers the fixture places'). The fraud tile reads those accounts and never claims persona-level fraud.

## Why
Cannot attach the simulator to seeded personas.

## Consequences
Tile copy says 'Across the bank today'. sim account ids stored in data/sim-ids.json.
