import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef } from 'react'
import type { VariantProps } from 'class-variance-authority'
import { cn } from '../../utils/cn'
import { btnVariants } from './btnVariants'

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
