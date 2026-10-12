---
paths:
  - '**/*.css'
  - '**/styles/**'
  - 'packages/component-lib/src/design/**'
---

# Styling — tokens, style objects, one stylesheet

Tailwind is being removed. **The plan and its phases live in
[`docs/design-system/tailwind-removal.md`](../../docs/design-system/tailwind-removal.md)**
— read it before migrating a component. What an editor needs:

- **Target pattern:** `packages/component-lib/src/design/tokens.ts` (typed
  scale) + `packages/component-lib/src/styles/index.css` (the one stylesheet
  every consumer loads; `.su-*` classes over the `theme.css` tokens). The
  Dashboard's `.su-dash-*` rules (the old `.pc-*`) are ITUN's
  (`apps/itun/src/styles/dashboard/`), not component-lib's.
- **The split is per-PROPERTY.** A property with no stateful or responsive
  variant on that element → style object. A property with **any** (`:hover`,
  `:focus-visible`, `:disabled`, `@media`, pseudo-elements, sibling selectors)
  → a `.su-*` class, **resting value included** — an inline `style=` beats every
  stylesheet rule, so a split property's hover silently never fires. `cn()`
  remains only on surfaces still on Tailwind.
- **Class-string exports** (`buttonVariants`, `capsLabel`, the `FOCUS_*` /
  `DISABLED` / `SELECTION_RING*` vocabulary) are stylesheet-only, and their
  `.su-*` names are public API. The exemption does not extend to components.
- **Edit `tokens.ts` and `theme.css` together** — `theme.css` is the one
  token set, and `src/design/tokens.parity.test.ts` fails if they disagree.
- **Do not add Tailwind or `.pc-*` classes.** `bun run check styling` ratchets
  `tailwind-utility-file` down and holds `pc-class-defined` at 0; if you
  removed Tailwind, lower the baseline with `--update-baseline` in the same PR.
  `pc-class-contract` fails a `su-dash-*` class used in TSX but defined in no
  `styles/dashboard/*.css` file, or defined and never used.
- `packages/component-lib/src/styles/tailwind.css` is the one Tailwind entry:
  it imports `index.css` into `layer(su-base)` (load-bearing while both systems
  are live), and the two apps and `src/styles/catalog.css` import it rather
  than Tailwind. Catalog-only CSS goes in `src/stories/_stories.css`, not
  `index.css`.
- **Checking a focus ring with `el.focus()` lies**: `:focus-visible` needs a
  real key press. Checking layer order by block position lies: read the
  `@layer` declaration. Details in the plan, §6.
