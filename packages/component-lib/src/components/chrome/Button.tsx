import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef } from 'react'
import type { VariantProps } from 'class-variance-authority'
import { cn } from '../../utils/cn'
import { buttonVariants } from './buttonVariants'

type ButtonProps = ComponentPropsWithoutRef<'button'> & VariantProps<typeof buttonVariants>

/**
 * App-chrome button (design-spec §2.4 `.btn`): paper/ink default with
 * `primary` (rust — THE action color), `ghost`, `danger` variants and
 * `sm`/`lg` sizes. Disabled = opacity .4, pointer-events none.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, className, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
})
