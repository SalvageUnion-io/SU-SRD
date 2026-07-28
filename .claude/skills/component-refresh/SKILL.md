---
name: component-refresh
description: Redesign an existing component through the three-level loop — real SSR "before", NEW* Ladle comparison, then staged cutover
allowed-tools: Bash, Read, Edit, Write, Glob, Grep
---

# Component Refresh

Drive a component redesign through the repeatable three-level loop. This is the
dominant kind of work in this repo, and the loop that makes it safe already
exists as prose — it just was not invokable, so every session reconstructed it
from a paragraph and some skipped the parts that make it safe.

**The methodology lives in
[`docs/design/entity-card-reconciliation.md`](../../../docs/design/entity-card-reconciliation.md)
Part 1 — read it first, and treat it as the source of truth.** Do not restate it
here or anywhere else; a second copy drifts, and `validate:doc-drift` exists
because that has already happened. This skill is the operating procedure for
running it.

## Before starting

Ask which level is being requested, and do not silently cross a gate:

- **L1 (mockup)** — design only. Produces an artifact. Changes no app code.
- **L2 (build alongside)** — `NEW`-prefixed components, Ladle-only, no consumers.
- **L3 (cutover)** — migrate consumers and delete the legacy component.
  **Explicit command only.** Never begin L3 because L2 looks finished.

If the request is ambiguous, assume the _lower_ level and say so.

## L1 — mockup, grounded in a real "before"

The single rule that carries this level: **the "before" is the actual current
component rendered from real code, never a hand-authored caricature.** A
caricature hides exactly the wrapping, overflow, tone and empty-state bugs the
refresh is supposed to fix, so a mockup built against one is designing for a
component that does not exist.

- Render it via SSR — `react-dom/server` `renderToStaticMarkup` plus compiled
  Tailwind (`@tailwindcss/node` + `@tailwindcss/oxide` Scanner over the rendered
  markup, theme fonts embedded as data URIs). Capture HTML + CSS, not
  screenshots.
- Feed it **real ORM data** (`SalvageUnionReference.*`), deliberately including
  the awkward records — longest name, empty description, missing artwork.
- Settle the read-only design before touching anything editable.

## L2 — build alongside, never in place

- New components carry a `NEW` prefix so they cannot collide with the legacy
  one, are **not** barrel-exported, and have **no consumers**. Iteration is then
  zero-risk.
- Show them as a **three-way Ladle story on one page**: old · new read-only ·
  new editable, all driven by real data through the real components.
  `bun run ladle`
- Add any write layer as **evolutions of the read-only card, never a redesign**.

## L3 — cutover, staged and green at every step

Only on explicit instruction. Follow the staged plan in the canonical doc
(rename → barrel + compat shim → migrate consumers lowest-risk first → delete
legacy and canonicalize stories), committing per stage.

## Invariants — check these at every level

- **Read-only byte-identical.** Every write-layer or migration change is
  additive and prop-gated: a card with no write props must render exactly as
  before. Prove it by diffing rendered `innerHTML` against `HEAD` — do not
  assert it from reading the diff.
- **Green at every checkpoint.** `bun run typecheck`, `bun run lint`,
  `bun run test`, `bun run validate:all` — committed per stage, not batched to
  the end.
- **Real data everywhere** — mockups, stories and SSR captures alike.
- **Prefer changing the data shape over special-casing the renderer.** A
  renderer full of per-entity branches is the failure mode this repo keeps
  paying for.

## Finishing

Report which level completed, what is now safe to delete, and what the next
level would involve. If L2 finished, say explicitly that the legacy component is
still the one users see — the work is not visible until L3.
