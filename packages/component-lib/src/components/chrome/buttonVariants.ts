import { cva } from 'class-variance-authority'
import { capsLabel } from './capsLabel'
import { DISABLED, FOCUS_RING } from './interaction'

/**
 * The `.btn` cva recipe (design-spec §2.4), exported for non-button elements
 * (e.g. links styled as buttons) so consumers don't re-inline the class string.
 * Lives in its own file so Button.tsx only exports components (react-refresh).
 *
 * ## Emits `.su-btn*` class names now, not Tailwind classes (#799, epic #802)
 *
 * Same three axes, same values, same defaults, same `(opts) => string`
 * signature — so **no call site moves**, including the ~30 in `apps/itun` and
 * `apps/srd` that put the result on `<a>` elements. Only the names changed; the
 * rules behind them live in `src/styles/index.css`.
 *
 * **ALL of the styling moved there, geometry and type included** — not just the
 * stateful half the split rule would send to a stylesheet. That is not an
 * exception to the rule, it is the rule's boundary: the split rule assumes the
 * library owns the element being styled, and this recipe deliberately does not.
 * A caller putting this string on an `<a>` never receives a style object, and a
 * function returning a string cannot return one without changing a signature
 * that is public API. See the class-string exemption in this package's
 * CLAUDE.md.
 *
 * The `.su-btn*` names are public API from that same moment, for the same
 * reason — apps compose them with `cn()`, so they end up in app-side code.
 *
 * ## The axes
 *
 * The `surface` axis picks the WORLD the button lives on: `paper` (default —
 * the light app chrome) or `instrument` (the dashboard HUD scope, `.pc-root`).
 * The instrument surface swaps in the condensed-caps HUD typography and the
 * recessed treatment formerly hand-rolled as `.pc-btn` / `.pc-deck-btn` /
 * `.pc-railbtn` / `.pc-wheel-btn` in instruments.css — one standard Button for
 * both worlds. Colour deltas ride on `compoundVariants` (surface × variant);
 * only `ghost` has an instrument recolour — the sole variant the HUD uses.
 *
 * Note the instrument surface is a TYPOGRAPHY choice as much as a colour one:
 * the cockpit's chassis is cream, not dark, so its buttons are ink like the
 * rest of the app — what still separates them is condensed caps.
 *
 * Both `instrument` and `mini` still compose `capsLabel`, which is why that
 * recipe must itself stay a class-string emitter (see its own note).
 */
export const buttonVariants = cva(`su-btn ${FOCUS_RING} ${DISABLED}`, {
  variants: {
    variant: {
      default: 'su-btn--default',
      primary: 'su-btn--primary',
      ghost: 'su-btn--ghost',
      danger: 'su-btn--danger',
    },
    surface: {
      // Light app chrome — the paper/ink/rust world (the existing default).
      paper: '',
      // Dashboard HUD — condensed-caps typography; the ghost recolour (the one
      // variant the HUD uses) rides on the compoundVariant below. Size rides on
      // the `size` axis, so the recipe is role-only.
      instrument: `su-btn--instrument ${capsLabel()}`,
    },
    // The canonical size ladder (styles/sizing.ts) — full / compact / mini.
    size: {
      /** The reading size for a primary CTA (formerly `lg`). */
      full: 'su-btn--full',
      /** The default workhorse scale (the former `sm`, which absorbed `md`). */
      compact: 'su-btn--compact',
      /**
       * The former MiniBtn / `xs`: a compact uppercase action chip for
       * secondary controls like '⇄ Swap' / '✕ Remove'. Its geometry is
       * `.su-btn--mini`; its condensed caps come from the recipe below, which
       * is why the two are composed rather than duplicated.
       */
      mini: `su-btn--mini ${capsLabel({ size: 'label-lg', weight: 'semibold', tracking: 'none' })}`,
      /** The SQUARE icon-only rung — a glyph with no label. */
      iconOnly: 'su-btn--icon-only',
    },
  },
  // NO `compoundVariants`, and the absence is deliberate.
  //
  // The instrument × ghost recolour still exists — it is the compound SELECTOR
  // `.su-btn--instrument.su-btn--ghost` in index.css, whose two-class
  // specificity beats plain `.su-btn--ghost` without relying on source order.
  // Both classes are already emitted by the `surface` and `variant` axes, so a
  // cva entry here would have to carry an empty `class` to do nothing, and dead
  // configuration that looks load-bearing is worse than none.
  //
  // (That recolour was previously paper text on transparent, for the retired
  // dark instrument skin. It survived the skin it was built for and only ever
  // rendered legibly because the base `text-ink` won a class-order race against
  // its arbitrary-value utility — white-on-white held off by luck. Now that the
  // cockpit chassis is cream, ink is simply correct.)
  defaultVariants: {
    variant: 'default',
    surface: 'paper',
    size: 'compact',
  },
})
