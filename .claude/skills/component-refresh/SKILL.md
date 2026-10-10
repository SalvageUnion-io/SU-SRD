---
name: component-refresh
description: Use when asked to redesign, refresh, restyle or "modernise" an existing component, or to mock one up before building it. Runs the three-level loop — real SSR "before", NEW* story-catalog comparison, staged cutover — and never crosses into L3 cutover without an explicit command.
allowed-tools: Bash, Read, Edit, Write, Glob, Grep
---

# Component Refresh

Drive a component redesign through the repeatable three-level loop. This is the
dominant kind of work in this repo. **This skill is the methodology** — it was
proven on the entity-card refresh, whose settled design rules are
[ADR-026](../../../docs/ARCHITECTURE.md#adr-026). Do not restate
it anywhere else; a second copy drifts.

## Before starting

Ask which level is being requested, and do not silently cross a gate:

- **L1 (mockup)** — design only. Produces an artifact. Changes no app code.
- **L2 (build alongside)** — `NEW`-prefixed components, catalog-only, no consumers.
- **L3 (cutover)** — migrate consumers and delete the legacy component.
  **Explicit command only.** Never begin L3 because L2 looks finished.

If the request is ambiguous, assume the _lower_ level and say so.

**Design intent comes from the origin**
(<https://claude.ai/artifact/5r8RNGXQc41ed6io4oYHXm>), the design's source of
truth. Open the board the refresh names before drawing anything.
[`docs/design-system/ruleset.md`](../../../docs/design-system/ruleset.md)
codifies the origin's rules for code and the gates; where the two disagree, the
origin wins and the ruleset is amended to match.

## L1 — mockup, grounded in a real "before"

The single rule that carries this level: **the "before" is the actual current
component rendered from real code, never a hand-authored caricature.** A
caricature hides exactly the wrapping, overflow, tone and empty-state bugs the
refresh is supposed to fix, so a mockup built against one is designing for a
component that does not exist.

- Render it via SSR — `react-dom/server` `renderToStaticMarkup` (precedent:
  `apps/srd/ssg/document.tsx`), styled by the stylesheet `bun --filter srd build`
  emits (named in the build's Vite manifest under apps/srd/dist).
  `packages/component-lib/src/styles/tailwind.css` is only its Tailwind
  source, which a browser cannot read. Use no package this repo does not declare.
  Capture HTML + CSS, not screenshots.
- Feed it **real ORM data** (`SalvageUnionReference.*`), deliberately including
  the awkward records — longest name, empty description, missing artwork.
- Settle the read-only design before touching anything editable.

## L2 — build alongside, never in place

- New components carry a `NEW` prefix so they cannot collide with the legacy
  one, are **not** barrel-exported, and have **no consumers**. Iteration is then
  zero-risk.
- Show them as a **three-way story on one page**: old · new read-only ·
  new editable, all driven by real data through the real components. Open the
  `stories` launch config (`.claude/launch.json`, port 61000), or `bun run stories`
  outside Claude Code.
- **Capture the comparison from the canvas-only URL**, not the sidebar view:
  `/?story=<id>&mode=canvas&width=phone` (presets `phone` 375, `column` 480,
  `page` 1200), on a catalog started at your own port with
  `bunx vite --port N --strictPort`. `bun run stories:ids <filter>` finds the
  id. Stories render in the product's Barlow faces, so a wrap or clip in the
  capture is real. The steps are in
  [component-lib's guide](../../../packages/component-lib/CLAUDE.md#capturing-a-story).
- Add any write layer as **evolutions of the read-only card, never a redesign**.

## L3 — cutover, staged and green at every step

Only on explicit instruction. Stage it, committing per stage:

1. Close the new component's parity gaps: inventory every legacy prop a
   consumer uses and add the missing ones, additively.
2. Rename `NEW*` to canonical, flip the barrel, and leave a compat shim under
   the legacy name so every consumer renders through the new component.
3. Migrate consumers, lowest-risk first.
4. Delete the legacy component and the shim, and move its stories into their
   canonical story groups.

## Invariants — check these at every level

- **Read-only byte-identical.** Every write-layer or migration change is
  additive and prop-gated: a card with no write props must render exactly as
  before. Prove it by diffing rendered `innerHTML` against `HEAD` — do not
  assert it from reading the diff.
- **Green at every checkpoint.** `bun run typecheck`, `bun run lint`,
  `bun run test`, `bun run check data doc-drift` — committed per stage, not batched to
  the end.
- **Real data everywhere** — mockups, stories and SSR captures alike.
- **Prefer changing the data shape over special-casing the renderer.** A
  renderer full of per-entity branches is the failure mode this repo keeps
  paying for.

## Finishing

Report which level completed, what is now safe to delete, and what the next
level would involve. If L2 finished, say explicitly that the legacy component is
still the one users see — the work is not visible until L3.
