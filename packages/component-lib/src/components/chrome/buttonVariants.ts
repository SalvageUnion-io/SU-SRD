import { cva } from 'class-variance-authority'
import { DISABLED, FOCUS_RING } from './interaction'

/**
 * The `.btn` cva recipe (design-spec §2.4), exported for non-button elements
 * (e.g. links styled as buttons) so consumers don't re-inline the class
 * string. Lives in its own file so Button.tsx only exports components
 * (react-refresh).
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
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)
