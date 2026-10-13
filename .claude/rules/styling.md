---
paths:
  - '**/*.css'
  - '**/styles/**'
  - 'packages/component-lib/src/design/**'
---

# Styling — tokens, style objects, one stylesheet

The system is [ADR-046](../../docs/ARCHITECTURE.md#decisions); there is no
utility framework (`bun run check styling`'s `no-tailwind` keeps it out).
What an editor needs:

- **The pattern:** `packages/component-lib/src/design/tokens.ts` (typed
  scale) + `packages/component-lib/src/styles/index.css` (the one stylesheet
  every consumer loads; `.su-*` classes over the `theme.css` tokens). Its
  rules live in `styles/partials/`, one part per group, which `index.css`
  `@import`s in cascade order; tests read them joined
  (`styles/__tests__/packageStylesheet.ts`). The Dashboard's `.su-dash-*`
  rules are ITUN's (`apps/itun/src/styles/dashboard/`); any other ITUN- or
  srd-only rule lives in that app's stylesheets, because srd loads
  `index.css` too.
- **The written form**, one spelling each:
  - static → `const NAME = { … } satisfies CSSProperties` at module scope,
    never `const NAME: CSSProperties =`, which widens every value (the
    `style-object-annotation` ratchet burns it down);
  - varies by instance → an inline literal of only the varying values,
    spreading the static object (`style={{ ...NAME, color }}`), or a
    function returning `CSSProperties` when several uses share it;
  - stateful, responsive or repeated → a `.su-*` class, joined with `cn`;
    a component's class variants are a `cva` class-string export.
- **The split is per-PROPERTY.** A property with no stateful or responsive
  variant on that element → style object. A property with **any** (`:hover`,
  `:focus-visible`, `:disabled`, `@media`, pseudo-elements, sibling selectors)
  → a `.su-*` class, **resting value included** — an inline `style=` beats every
  stylesheet rule, so a split property's hover silently never fires.
- **Repeated on many elements per page → a class too.** srd renders static
  HTML, so a style object is written out on every element that wears it (a
  listing row's parts, a stat cell, card chrome); only what varies by
  instance stays inline. A class laid over another component's classes (a
  Badge stamp) must come after them in the import order: at one class each,
  source order decides. A class also loses to an app's unlayered element
  rule (ITUN's heading face, `print.css`'s `span` and `h1`–`h3` sizes) and
  drops out of a rule that matched the inline style (`print.css`'s
  `[style*='border']` ink): check both apps, print included. ITUN hands a
  class back with `revert-layer` (`styles/libHandback.css`, `print.css`)
  and names it in the border-ink rule.
- **Class-string exports** (`buttonVariants`, `capsLabel`, the `FOCUS_*` /
  `DISABLED` / `SELECTION_RING*` vocabulary) are stylesheet-only, and their
  `.su-*` names are public API; the exemption does not extend to
  components. No speculative style object: add one with the component that
  needs it.
- **Edit `tokens.ts` and `theme.css` together**:
  `src/design/__tests__/tokens.parity.test.ts` fails if they disagree.
- **The one entry:** `packages/component-lib/src/styles/entry.css` declares
  `@layer su-reset, su-base;`, imports `theme.css` unlayered, `reset.css` into
  `su-reset` and `index.css` into `su-base`. The two apps and
  `apps/catalog/src/catalog.css` import it, never `index.css`, and their own
  stylesheets stay unlayered so an app rule outranks a package rule
  (`package-stylesheet-import` guards it). Catalog-only CSS goes in
  `src/stories/_stories.css`.
- **No `.pc-*` class** (the retired Dashboard scope); `dash-class-contract`
  holds `su-dash-*` usage and definitions to each other.
- **Checking a focus ring with `el.focus()` lies**: `:focus-visible` needs a
  real key press. Checking layer order by block position lies: read the
  `@layer` declaration.
