import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../utils/cn'

const btnVariants = cva(
  'inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[3px] border-[1.5px] font-body font-medium tracking-[0.01em] transition-colors duration-[120ms] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rust/25 disabled:pointer-events-none disabled:opacity-40',
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
        md: 'px-4 py-[9px] text-[13px]',
        lg: 'px-[22px] py-3 text-[15px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

type BtnProps = ComponentPropsWithoutRef<'button'> & VariantProps<typeof btnVariants>

/**
 * App-chrome button (design-spec §2.4 `.btn`): paper/ink default with
 * `primary` (rust — THE action color), `ghost`, `danger` variants and
 * `sm`/`lg` sizes. Disabled = opacity .4, pointer-events none.
 */
export const Btn = forwardRef<HTMLButtonElement, BtnProps>(function Btn(
  { variant, size, className, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(btnVariants({ variant, size }), className)}
      {...props}
    />
  )
})
