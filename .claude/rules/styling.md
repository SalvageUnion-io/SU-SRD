---
paths:
  - '**/*.css'
  - '**/styles/**'
  - 'apps/web/src/design/**'
---

# Styling — tokens, style objects, one stylesheet

ADR-046; no utility framework. `bun run check styling` holds the tokens,
prefixes, rust allowlist and entry; its messages say the fix.

- **The pattern:** `apps/web/src/design/tokens.ts` (typed scale, kept equal to
  `theme.css` by a parity test) + `apps/web/src/styles/index.css`, the one
  stylesheet, `@import`ing `styles/partials/` in cascade order. Play's
  `.su-dash-*` and `.su-play-*` rules live in `apps/web/src/styles/play/`; any
  other app- or page-only rule lives in that half's stylesheets.
- **One spelling each:** static → `const NAME = { … } satisfies CSSProperties`
  at module scope (never `const NAME: CSSProperties =`); varies by instance → an
  inline literal of only the varying values spreading the static one, or a
  function returning `CSSProperties`; stateful, responsive or repeated → a
  `.su-*` class joined with `cn` (variants: `as const` lookup maps).
- **The split is per property:** any `:hover`, `:focus-visible`, `@media`,
  pseudo-element or sibling variant makes the whole property a class, resting
  value included, because an inline `style=` beats every stylesheet rule.
- **Repeated on many elements per page → a class:** static HTML writes a style
  object out on every element. A class laid over another component's must come
  later in import order, and loses to an app's unlayered element rule (the
  app's heading face, `print.css`): check pages, the app and print. The app
  hands a class back with `revert-layer` (`styles/build/libHandback.css`).
- Class-string exports (`buttonVariants`, `capsLabel`, `FOCUS_*`, …) are public
  API by their `.su-*` names. No speculative style object.
- **The one entry**, `apps/web/src/styles/entry.css`: `@layer su-reset, su-base;`,
  `theme.css` unlayered, `reset.css` and `index.css` into their layers; both
  render modes import it and keep their own stylesheets unlayered.
- `el.focus()` does not trigger `:focus-visible` (a real key press does); read
  layer order from the `@layer` declaration, not block position.
