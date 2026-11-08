# ADR-011: Car card uses 2D images, not 3D

**Status:** accepted · 2026-11-07 (T0 spike, 10 min cap)

## Decision
Car card renders a 2D PNG per model from `public/cars/`. No react-three-fiber in the 20h.

## Why
Spike found no CC-BY/CC0 glTF of a modern Toyota (Camry/RAV4/Corolla). Only CC result was a Corolla AE86 Trueno (Sketchfab, CC-BY, NoAI tag). CGTrader/TurboSquid models are paid/royalty-free, not CC.

## Consequences
3D is a hour-17 stretch only if a licensed model appears. Image attribution recorded in `public/cars/CREDITS.md`.
