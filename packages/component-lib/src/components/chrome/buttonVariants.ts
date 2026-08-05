import { cva } from 'class-variance-authority'
import { capsLabel } from './capsLabel'
import { DISABLED, FOCUS_RING } from './interaction'

/**
 * The disabled treatment for FILLED variants (`primary`, `danger`).
 *
 * The shared `DISABLED` fades whatever is there to 40% opacity, which is right
 * for an outline button but wrong for a solid fill: rust at 40% is a pastel
 * salmon and red at 40% is pink, and both read as an enabled variant nobody
 * recognises rather than as an off control. A disabled control should look
 * *drained*, not *tinted*, so the fill is emptied to a flat ink wash instead.
 * `opacity-100` cancels the base fade (variant classes are emitted after the
 * base, so this wins the merge).
 */
const DRAINED = 'disabled:opacity-100 disabled:border-ink-30 disabled:bg-ink-8 disabled:text-ink-50'

/**
 * The `.btn` cva recipe (design-spec §2.4), exported for non-button elements
 * (e.g. links styled as buttons) so consumers don't re-inline the class
 * string. Lives in its own file so Button.tsx only exports components
 * (react-refresh).
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
 */
export const buttonVariants = cva(
  `inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-card border-chrome font-body font-medium tracking-normal transition-colors duration-[120ms] ${FOCUS_RING} ${DISABLED}`,
  {
    variants: {
      variant: {
        default: 'border-ink bg-paper text-ink hover:bg-ink-8',
        primary: `border-rust bg-rust text-paper hover:border-rust-hi hover:bg-rust-hi ${DRAINED}`,
        ghost: 'border-ink bg-transparent text-ink hover:bg-ink-8',
        danger: `border-status-bad bg-status-bad text-paper hover:opacity-90 ${DRAINED}`,
      },
      surface: {
        // Light app chrome — the paper/ink/rust world (the existing default).
        paper: '',
        // Dashboard HUD — condensed-caps typography; the ghost recolour
        // (the one variant the HUD uses) rides on the compoundVariant below.
        // Size rides on the `size` axis below, so the recipe is role-only.
        instrument: capsLabel(),
      },
      // The canonical size ladder (styles/sizing.ts) — full / compact / mini.
      size: {
        // The reading size for a primary CTA (formerly `lg`).
        full: 'px-[22px] py-3 text-lede',
        // The default workhorse scale (the former `sm`, which absorbed `md`
        // when the four-rung axis was merged down to the ladder's three).
        compact: 'px-[11px] py-[6px] text-xs',
        // The former MiniBtn / `xs`: a compact uppercase action chip (badge
        // radius, condensed caps, tight padding) for secondary controls like
        // '⇄ Swap' / '✕ Remove'. Overrides the base radius/font/gap via twMerge.
        mini: `gap-1 rounded-badge px-2 py-[3px] ${capsLabel({ size: 'label-lg', weight: 'semibold', tracking: 'none' })}`,
        /**
         * The SQUARE icon-only rung — a glyph with no label (a close ✕, a
         * collapse chevron, a search magnifier).
         *
         * It is a `size` rung rather than a separate component because an icon
         * button differs from a worded one only in its geometry: same frame,
         * same variants, same focus ring, same disabled treatment. Before this
         * there were five hand-rolled squares across the package — 28 / 32 / 36
         * / 44px, three radii, four border treatments — and the one with no
         * visible focus ring at all was the only one a keyboard user could not
         * see.
         *
         * 36px (`size-9`) is the resting geometry: comfortably past the WCAG
         * 2.5.8 24px minimum, and the size the majority of those squares
         * already were. A call site whose button must line up with a
         * neighbouring control of a different height overrides with a single
         * `size-*` class (the sheet slab's chevron matches its `compact`
         * siblings at `size-7`; a phone's bar trigger holds the 44px WCAG
         * 2.5.5 target at `size-11`) — one class, not a whole re-spelled skin.
         */
        iconOnly: 'size-9 shrink-0 gap-0 p-0 text-base leading-none',
      },
    },
    compoundVariants: [
      // INSTRUMENT recolour: an ink hairline on the transparent chassis, going
      // to a paper fill on hover — the ghost treatment for a button sitting on
      // a cream instrument card (rail, band, dial).
      //
      // This was previously paper text on transparent, for the retired dark
      // instrument skin. It survived the skin it was built for and only ever
      // rendered legibly because the base `text-ink` won a class-order race
      // against its arbitrary-value utility — i.e. white-on-white held off by
      // luck. Now that the cockpit chassis is cream, ink is simply correct.
      {
        surface: 'instrument',
        variant: 'ghost',
        class: 'border-ink-30 bg-transparent text-ink hover:border-ink-50 hover:bg-paper',
      },
    ],
    defaultVariants: {
      variant: 'default',
      surface: 'paper',
      size: 'compact',
    },
  }
)
