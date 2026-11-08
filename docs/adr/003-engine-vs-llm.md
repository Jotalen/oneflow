# ADR-003: Deterministic engine, LLM narrates

**Status:** accepted · 2026-11-07

## Decision
All arithmetic happens in src/lib/engine (pure TS). The LLM receives tool JSON and may only quote numbers from it.

## Why
PNC and Toyota responsible-AI rules: code computes, model explains.

## Consequences
Coach tools return engine output; prompt forbids arithmetic; a deterministic stub provider must carry the full demo when no key is set.
