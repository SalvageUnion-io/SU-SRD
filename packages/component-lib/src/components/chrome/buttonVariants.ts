import { cva } from 'class-variance-authority'
import { DISABLED, FOCUS_RING } from './interaction'

/**
 * The `.btn` cva recipe (design-spec §2.4), exported for non-button elements
 * (e.g. links styled as buttons) so consumers don't re-inline the class
 * string. Lives in its own file so Button.tsx only exports components
 * (react-refresh).
 *
 * The `surface` axis picks the WORLD the button lives on: `paper` (default —
 * the light app chrome) or `instrument` (the dark dashboard HUD scope, `.pc-root`).
 * The instrument surface swaps in the condensed-caps HUD typography and the
 * dark recessed treatment formerly hand-rolled as `.pc-btn` / `.pc-deck-btn` /
 * `.pc-railbtn` / `.pc-wheel-btn` in instruments.css — one standard Button for
 * both worlds. Colour deltas ride on `compoundVariants` (surface × variant).
 */
export const buttonVariants = cva(
  `inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-card border-chrome font-body font-medium tracking-[0.01em] transition-colors duration-[120ms] ${FOCUS_RING} ${DISABLED}`,
  {
    variants: {
      variant: {
        default: 'border-ink bg-paper text-ink hover:bg-wk-bg-2',
        primary: 'border-rust bg-rust text-paper hover:border-rust-hi hover:bg-rust-hi',
        ghost: 'border-ink bg-transparent text-ink hover:bg-wk-bg-2',
        danger: 'border-danger bg-danger text-paper hover:opacity-90',
      },
      surface: {
        // Light app chrome — the paper/ink/rust world (the existing default).
        paper: '',
        // Dark dashboard HUD — condensed-caps typography; colours per variant
        // come from the compoundVariants below (recessed dark fill, paper text).
        instrument: 'font-cond font-bold uppercase tracking-caps-tight',
      },
      size: {
        // `xs` is the former MiniBtn: a compact uppercase action chip (badge
        // radius, condensed caps, tight padding) for secondary controls like
        // '⇄ Swap' / '✕ Remove'. Overrides the base radius/font/gap via twMerge.
        xs: 'gap-1 rounded-badge px-2 py-[3px] font-cond text-label-lg font-semibold uppercase tracking-normal',
        sm: 'px-[11px] py-[6px] text-xs',
        md: 'px-4 py-[9px] text-caption',
        lg: 'px-[22px] py-3 text-lede',
      },
    },
    compoundVariants: [
      // INSTRUMENT recolours (dark HUD). Each mirrors the former instruments.css
      // `.pc-*` treatment so the swap is visually faithful: a recessed dark fill
      // (ink mixed toward black), paper text, a faint paper-tinted border that
      // brightens to muted on hover.
      {
        surface: 'instrument',
        variant: 'default',
        class:
          'border-[color-mix(in_srgb,var(--color-su-paper)_16%,transparent)] bg-[color-mix(in_oklab,var(--color-ink)_50%,#000)] text-[var(--color-su-paper)] hover:border-[var(--color-su-muted)] hover:bg-[color-mix(in_oklab,var(--color-ink)_64%,#000)]',
      },
      {
        surface: 'instrument',
        variant: 'ghost',
        class:
          'border-[color-mix(in_srgb,var(--color-su-paper)_16%,transparent)] bg-transparent text-[var(--color-su-paper)] hover:border-[var(--color-su-muted)]',
      },
      {
        surface: 'instrument',
        variant: 'primary',
        class:
          'border-[var(--color-pilot)] bg-[var(--color-sheet-pilot-deep)] text-[var(--color-paper)] hover:border-[var(--color-su-muted)]',
      },
      {
        surface: 'instrument',
        variant: 'danger',
        class:
          'border-[color-mix(in_srgb,var(--color-status-bad)_70%,#000)] bg-[color-mix(in_oklab,var(--color-ink)_50%,#000)] text-[var(--color-danger)] hover:border-[var(--color-su-muted)]',
      },
    ],
    defaultVariants: {
      variant: 'default',
      surface: 'paper',
      size: 'md',
    },
  }
)
