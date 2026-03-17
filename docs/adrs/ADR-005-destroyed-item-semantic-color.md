# ADR-005: Destroyed Item Semantic Color

## Status

Accepted

## Context

Destroyed equipment needs a distinct visual treatment so players can immediately identify unusable items at a glance. The existing `damageOverlayText` overlay in `ReferenceEntityDisplay` uses `bg-red-800/90` — a raw Tailwind red class, not an SU brand token from the theme.

The question arose: should destroyed state be mapped to `bg-su-rust` or another SU brand token to keep the UI consistent with the project's color palette?

## Decision

Keep `bg-red-800/90` for destroyed state. Do not map this to `bg-su-rust` or any SU brand token.

Red = destroyed/critical is a universal semantic convention with strong cognitive load advantages. Users across gaming contexts, software UIs, and everyday life associate red with danger and critical failure. Mapping this to a brand-specific rust tone would reduce the immediate clarity of the signal.

The SU brand palette communicates identity. The semantic red communicates game state. These are different jobs and should not be conflated.

## Consequences

- `bg-red-800/90` is the canonical color for the destroyed state overlay. It is documented here as an intentional exception to the brand token pattern.
- Do not refactor destroyed-state colors to SU brand tokens in future UI work.
- The `damaged` state (grey header, `bg-su-grey`) continues to use the brand token because grey is neutral, not semantically loaded.
- If the SU brand palette ever changes, destroyed-state colors do not need to follow.
