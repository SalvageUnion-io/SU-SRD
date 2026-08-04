# TTRPG UX Designer - Agent Memory

> **Rebuilt 2026-08-03 after an audit.** The previous version of this file was a
> full design generation out of date: it described a three-layer display stack,
> `ReferenceEntityDisplay`, `FilterChip`, `StatsBar`, `ValueDisplay`, Radix +
> ShadCN, `src/components/ui/`, and a Supabase-era `entity_refs` / realtime data
> flow — **none of which exist**. Component inventories written in prose rot
> here faster than anywhere else in the repo.
>
> **Rule for this file: record laws and intent, not rosters.** Before repeating
> any component name from memory, confirm it in
> `packages/component-lib/src/index.ts`.

## Project Structure

- Monorepo at `~/Code/SU-SRD/` (workspace root; use repo-relative paths in notes)
- Design canon: `docs/design-system/ruleset.md` — the authoritative laws. Build
  order in `canonical-primitive-language.md`.
- Architecture docs: `docs/architecture/` (display-system, data-flow,
  accounts-and-games, package-contracts, seo-accessibility, dashboard)
- Shared theme: `packages/component-lib/src/styles/theme.css` — **the single
  home for every design token.** Apps may not define one
  (`tools/check-styling-ownership.ts` fails the build at pre-push).
- Game data: `packages/salvageunion-reference/` (ORM-like API)
- ITUN app: `apps/itun/` (React 19 + Vite + TanStack Router + Tailwind v4,
  Base UI primitives via component-lib). SRD site: `apps/srd/` (Astro 7 +
  React islands).

## Dataviz Idioms (pips/tracks/roll readouts)

See [dataviz-idioms.md](dataviz-idioms.md) — the unified segment-state logic,
the over-capacity red idiom, heat escalation, roll colour scope.

## The display system (two shells, not a stack)

- **`ReferenceEntityCard`** — THE renderer for every SRD entity in both apps.
  Owns entity recursion (nested systems/modules/actions/grants render as nested
  cards, bounded by a depth guard).
- **`Card`** — the generic four-band container (header / sub-header /
  body+expand / footer) that non-entity surfaces compose.
- They are **not** being merged and `ReferenceEntityCard` does not render
  through `Card`. The reasons are recorded in
  `docs/architecture/display-system.md`; do not re-propose the merge without
  reading them.
- Card sizing = two orthogonal axes, `size` (`large | medium | small`) and
  `extent` (`full | head | catalog`), in `components/shared/displayMode.ts`. The
  old boolean `compact` / `listing` props are gone.

## Design canon to design inside (ruleset.md)

- §0 the one law: **one kind × one context = one primitive.** Geometry is
  constant across contexts; only materials, density and scale change.
- §5 the irreducible set: **11 atoms + 1 technique** — Stamp, Frame, StampSeam
  (technique), Badge, Well, Gauge, Btn, Slab, RollTable, ConditionSwatch,
  SlotGrid, Icons. The "instruments" (VitalGauge and friends) are **named
  compositions**, not atoms. Prefer merging into an atom over adding a twelfth.
- §6 the audience test: merge any primitive that does not serve a genuinely
  different **reader intent** — not a different page, size or theme.
- §7 two inviolable laws: the value-cell law and the StampSeam law (the
  border-riding label).
- Rust is the action colour and Btn is the **only** mutator.

## Storage modes (ADR-030) — every surface needs all three

- **Solo** — not signed in. IndexedDB is the truth, nothing is gated. Default,
  first-class, must keep working forever. A build with no `VITE_CONVEX_URL` is
  permanently Solo, so no surface may call a Convex hook unconditionally.
- **Connected** — signed in. Convex is the server of record, IndexedDB is a cache.
- **Disconnected** — signed in and offline = **read-only**, not a write queue.
  Design the read-only state deliberately; do not show a disabled control with
  no explanation.

Games make crawlers genuinely multi-user (ownership, claim/release, proposals,
live crew vitals), so shared-space crawler UX is now a real requirement rather
than a hypothetical. See `docs/architecture/accounts-and-games.md`.

## Theme & Colour Notes

- **The whole `su-*` brand family is DELETED** (`su-orange-dark`, `su-paper`,
  `su-rust`, `su-brick`, `su-peach`, …). It was a shadow tokenset that gave one
  colour two spellings and made "rust = action, only action" unauditable. Never
  recommend an `su-*` utility — it generates nothing. The header comment in
  `theme.css` records the old → new mapping.
- Entity/ontology hues: `--color-pilot` orange, `--color-mech` green,
  `--color-crawler` pink, `--color-adversary` for world/opposition schemas
  (creatures, bio-titans, factions, NPCs, meld, squads). Hue encodes ontology.
- `--color-rust` (#a85222) is **the** single action colour — mutators only,
  never decoration. `--color-ink` / `--color-paper` are the reading pair;
  `--color-status-warn` / `--color-status-bad` are the sanctioned state tokens.
- The green and pink accents are border/accent-only, not text (WCAG AA).
- Heat escalates on the track: `heatDangerFrom(max)` (component-lib
  `stat/heatLevel.ts`) is the first pip index that reads `status-bad` red, at
  ~70% of cap. The colour escalation shipped; the `--animate-heat-pulse`
  keyframe in `theme.css` is defined but applied by nothing.
- Expansion-source theming ideas (claw-scratch, beveled border, rain-streak,
  CRT scanlines) remain unbuilt concepts, not shipped styling.

## Accessibility Patterns

- `eslint-plugin-jsx-a11y` in the lint configs; `tools/a11y-scan.ts`
  (puppeteer + axe-core) for runtime scanning.
- Clickable cards: `role="button"` + `tabIndex={0}` + Enter/Space keydown.
- Search: ARIA combobox with `aria-activedescendant`.
- Mobile touch targets: 44x44px min via `@media (pointer: coarse)`.
- Colour is never the only signal — the roll/outcome readouts name the outcome
  in text and use colour only to reinforce it.

## Historical UX reviews

`docs/design/itun-design-review.md` (moved out of the repo root 2026-08-03) is a
dated snapshot, not current state.
Several gaps it names are closed — the app now has a global brand header
(`AppHeader`, mounted in `routes/__root.tsx`), skeleton loading components, and
heat colour escalation. Re-verify any gap against the code before repeating it.
