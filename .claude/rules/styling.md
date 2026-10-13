---
paths:
  - '**/*.css'
  - '**/styles/**'
  - 'packages/component-lib/src/design/**'
---

# Styling — tokens, style objects, one stylesheet

The system is [ADR-046](../../docs/ARCHITECTURE.md#decisions); there is no
utility framework, and `bun run check styling` (`no-tailwind`) fails a Tailwind
package in any manifest or a Tailwind directive in any stylesheet. What an
editor needs:

- **The pattern:** `packages/component-lib/src/design/tokens.ts` (typed
  scale) + `packages/component-lib/src/styles/index.css` (the one stylesheet
  every consumer loads; `.su-*` classes over the `theme.css` tokens). The
  Dashboard's `.su-dash-*` rules are ITUN's (`apps/itun/src/styles/dashboard/`),
  not component-lib's; any other ITUN- or srd-only rule lives in that app's
  stylesheets, because srd loads `index.css` too.
- **The split is per-PROPERTY.** A property with no stateful or responsive
  variant on that element → style object. A property with **any** (`:hover`,
  `:focus-visible`, `:disabled`, `@media`, pseudo-elements, sibling selectors)
  → a `.su-*` class, **resting value included** — an inline `style=` beats every
  stylesheet rule, so a split property's hover silently never fires.
- **Repeated on many elements per page → a class too.** srd renders static
  HTML, so a style object is written out in full on every element that wears
  it: a listing row's parts, a stat cell, a card's chrome, the speckle layer.
  Those static styles are `.su-*` classes as well (they were 42% of srd's
  HTML); only what varies by instance (a tone, a size, a caller's frame) stays
  inline. A class laid over another component's classes (a Badge stamp) must
  come after that component's rules in `index.css`, since at one class each
  source order decides. Moving an inline style into a class also lets an app's
  unlayered element rule beat it (ITUN's heading face, `print.css`'s `span` and
  `h1`–`h3` sizes), and drops it out of a rule that matched the inline style
  (`print.css`'s `[style*='border']` ink): check both apps, print included.
  ITUN hands a class back with `revert-layer` (`styles/libHandback.css`,
  `print.css`) and names it in the border-ink rule.
- **Class-string exports** (`buttonVariants`, `capsLabel`, the `FOCUS_*` /
  `DISABLED` / `SELECTION_RING*` vocabulary) are stylesheet-only, and their
  `.su-*` names are public API. The exemption does not extend to components.
  No speculative style object: add one with the component that needs it.
- **Edit `tokens.ts` and `theme.css` together** — `theme.css` is the one
  token set (`:root` custom properties), and
  `src/design/__tests__/tokens.parity.test.ts` fails if they disagree.
- **The one entry:** `packages/component-lib/src/styles/entry.css` declares
  `@layer su-reset, su-base;`, imports `theme.css` unlayered, `reset.css` into
  `su-reset` and `index.css` into `su-base`. The two apps and
  `apps/catalog/src/catalog.css` import it, never `index.css` itself, and their own
  stylesheets stay unlayered so an app rule always outranks a package rule.
  `bun run check styling` (`package-stylesheet-import`) guards it. Catalog-only
  CSS goes in `src/stories/_stories.css`, not `index.css`.
- **No `.pc-*` class** (the retired Dashboard scope). `dash-class-contract`
  fails a `su-dash-*` class used in TSX but defined in no
  `styles/dashboard/*.css` file, or defined and never used.
- **Checking a focus ring with `el.focus()` lies**: `:focus-visible` needs a
  real key press. Checking layer order by block position lies: read the
  `@layer` declaration.
