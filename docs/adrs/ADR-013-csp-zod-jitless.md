# ADR-013: CSP-Compliant Zod (Jitless) as a Cross-Cutting Constraint

## Status

Accepted

## Context

Zod v4 ships a JIT object parser that compiles validators with `new Function(...)`
for speed. `new Function` is an `eval`-family feature, so it is blocked by a
strict Content Security Policy that omits `unsafe-eval`. `suref-web` serves a CSP
that denies `eval` ([ADR-012](ADR-012-suref-web-astro-static.md)), and Zod is the
backbone of the reference ORM ([ADR-005](ADR-005-reference-data-orm.md)) and
ITUN's entity validation. Left at its default, Zod's JIT would throw a CSP
violation at runtime in the browser.

## Decision

All Zod usage flows through a single module —
`packages/salvageunion-reference/lib/zod.ts` — which configures Zod with
`z.config({ jitless: true })`, disabling the JIT parser. **Import `z` from this
module** wherever schemas are constructed, rather than importing `zod` directly.

## Consequences

- Schema validation runs under a strict, `eval`-free CSP in the browser.
- There is a small validation-throughput cost from disabling the JIT; it is
  negligible for this dataset and worth the security posture.
- A new direct `import { z } from 'zod'` bypasses the config and can reintroduce
  the CSP violation — schema code must import `z` from the shared module. This is
  the one easy-to-miss rule that keeps the constraint enforced.
