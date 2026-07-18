import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import type { VariantProps } from 'class-variance-authority'
import { cn } from '../../utils/cn'
import { buttonVariants } from './buttonVariants'

type ButtonProps = ComponentPropsWithoutRef<'button'> &
  VariantProps<typeof buttonVariants> & {
    /**
     * Optional leading decorative glyph (e.g. the ⚄ roll die), rendered
     * `aria-hidden` before the label. The button's flex `gap` spaces it from
     * the text, so callers pass just the label as `children`.
     */
    glyph?: ReactNode
  }

/**
 * App-chrome button (design-spec §2.4 `.btn`): paper/ink default with
 * `primary` (rust — THE action color), `ghost`, `danger` variants and
 * `sm`/`lg` sizes. An optional leading `glyph` (e.g. '⚄ Roll') renders
 * aria-hidden before the label. Disabled = opacity .4, pointer-events none.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, className, type = 'button', glyph, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {glyph != null && <span aria-hidden="true">{glyph}</span>}
      {children}
    </button>
  )
})
