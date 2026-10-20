import { cn } from '../../lib/cn'
import { capsLabel } from './capsLabel'
import { DISABLED, FOCUS_RING } from './interaction'

/**
 * The `.btn` class recipe (design-spec §2.4). `Button` draws every button and
 * every link drawn as one (`Button href`); the recipe is called only there, in
 * `Toggle` and in `HeaderMenu`'s trigger (the `chrome/button-href` gate).
 * Lives in its own file so Button.tsx only exports components (react-refresh).
 *
 * ## Emits `.su-btn*` class names
 *
 * Three axes and a `(opts) => string` signature: a class string, so it can sit
 * on an element the library does not render (a Base UI trigger, a router link).
 * The rules behind the names live in `src/styles/index.css`.
 *
 * **ALL of the styling lives there, geometry and type included** — not just the
 * stateful half the split rule would send to a stylesheet. That is not an
 * exception to the rule, it is the rule's boundary: the split rule assumes the
 * library owns the element being styled, and this recipe deliberately does not.
 * A caller putting this string on an `<a>` never receives a style object, and a
 * function returning a string cannot return one without changing a signature
 * that is public API. See the class-string exemption in
 * `.claude/rules/styling.md`.
 *
 * The `.su-btn*` names are public API from that same moment, for the same
 * reason — apps compose them with `cn()`, so they end up in app-side code.
 *
 * ## The axes
 *
 * The `surface` axis picks the WORLD the button lives on: `paper` (default —
 * the light app chrome) or `instrument` (Play's canvas scope, `.su-play-root`).
 * It is a world, never a ground: on an ink band or plate the frame declares
 * `data-ground="ink"` (chrome K1) and the outlined variants (`default`,
 * `ghost`) read it in CSS, a paper outline with paper text, the one on-ink
 * ghost every band shares.
 * The instrument surface swaps in the condensed-caps HUD typography and the
 * recessed treatment — one standard Button for both worlds. Colour deltas ride on `compoundVariants` (surface × variant);
 * only `ghost` has an instrument recolour — the sole variant the HUD uses.
 *
 * Note the instrument surface is a TYPOGRAPHY choice as much as a colour one:
 * the cockpit's chassis is cream, not dark, so its buttons are ink like the
 * rest of the app — what still separates them is condensed caps.
 *
 * Both `instrument` and `mini` still compose `capsLabel`, which is why that
 * recipe must itself stay a class-string emitter (see its own note).
 */
const VARIANT = {
  default: 'su-btn--default',
  primary: 'su-btn--primary',
  ghost: 'su-btn--ghost',
  // No `danger`: no state colour fills a button (ruleset §3.1, hard rule R9).
  // A destructive act is rust (`primary`) behind `ConfirmDialog`.
  /** Filled ink, paper text: a close stamp on a lifted plate. */
  ink: 'su-btn--ink',
  /** Frameless, ink at 60%: an icon control inside a header (a close ×). */
  quiet: 'su-btn--quiet',
  /** Paper on a DASHED ink edge: the pencil control on an editable line
   *  (dashed means editable, as the User-made stamp is dashed). */
  pencil: 'su-btn--pencil',
} as const

const SURFACE = {
  // Light app chrome — the paper/ink/rust world (the default).
  paper: '',
  // Play's canvas — condensed-caps typography; the ghost recolour (the one
  // variant the HUD uses) is the compound selector
  // `.su-btn--instrument.su-btn--ghost` in index.css, whose two-class
  // specificity beats plain `.su-btn--ghost` without relying on source order.
  instrument: `su-btn--instrument ${capsLabel()}`,
} as const

// The canonical size ladder (styles/sizing.ts) — full / compact / mini.
const SIZE = {
  /** The reading size for a primary CTA. */
  full: 'su-btn--full',
  /** The default workhorse scale. */
  compact: 'su-btn--compact',
  /**
   * A compact uppercase action chip for
   * secondary controls like '⇄ Swap' / '✕ Remove'. Its geometry is
   * `.su-btn--mini`; its condensed caps come from the recipe below, which
   * is why the two are composed rather than duplicated.
   */
  mini: `su-btn--mini ${capsLabel({ size: 'badge', weight: 'semibold' })}`,
  /** The SQUARE icon-only rung — a glyph with no label. */
  iconOnly: 'su-btn--icon-only',
} as const

export type ButtonVariantProps = {
  variant?: keyof typeof VARIANT | null
  surface?: keyof typeof SURFACE | null
  size?: keyof typeof SIZE | null
}

export function buttonVariants({ variant, surface, size }: ButtonVariantProps = {}): string {
  return cn(
    'su-btn',
    FOCUS_RING,
    DISABLED,
    VARIANT[variant ?? 'default'],
    SURFACE[surface ?? 'paper'],
    SIZE[size ?? 'compact']
  )
}
