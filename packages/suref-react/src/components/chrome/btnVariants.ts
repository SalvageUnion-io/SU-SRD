import { cva } from 'class-variance-authority'

/**
 * The `.btn` cva recipe (design-spec §2.4), exported for non-button elements
 * (e.g. links styled as buttons) so consumers don't re-inline the class
 * string. Lives in its own file so Btn.tsx only exports components
 * (react-refresh).
 */
export const btnVariants = cva(
  'inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-card border-chrome font-body font-medium tracking-[0.01em] transition-colors duration-[120ms] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rust/25 disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        default: 'border-ink bg-paper text-ink hover:bg-wk-bg-2',
        primary: 'border-rust bg-rust text-su-white hover:border-rust-hi hover:bg-rust-hi',
        ghost: 'border-ink bg-transparent text-ink hover:bg-wk-bg-2',
        danger: 'border-danger bg-danger text-su-white hover:opacity-90',
      },
      size: {
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
