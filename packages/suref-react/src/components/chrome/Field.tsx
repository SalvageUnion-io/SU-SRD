import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { Text } from '../base/Text'

type FieldProps = {
  label: ReactNode
  /** Rust asterisk after the label */
  required?: boolean
  htmlFor?: string
  children: ReactNode
  className?: string
}

/**
 * Form field block (design-spec §2.5 `.field`): uppercase cond label with an
 * optional rust required-asterisk, wrapping any control (usually an Input).
 */
export function Field({ label, required = false, htmlFor, children, className }: FieldProps) {
  return (
    <div className={cn('relative block', className)}>
      {/* The field label IS the ink Stamp, straddling the input's top border
          (StampSeam) — the same seam the statblock box uses. The required mark
          rides inside the stamp (white on ink), not a separate rust glyph. */}
      <label
        htmlFor={htmlFor}
        className="absolute left-2 top-0 z-10 flex w-fit -translate-y-1/2 items-center"
      >
        <Text variant="pseudoheader" as="span" className="text-badge">
          {label}
          {required && (
            <span aria-hidden="true" className="ml-0.5">
              *
            </span>
          )}
        </Text>
      </label>
      {children}
    </div>
  )
}

type InputProps = ComponentPropsWithoutRef<'input'>

/**
 * Text input (design-spec §2.5 `.input`): paper bg, 1.5px ink border, 3px
 * radius, rust focus ring (no outline).
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={cn(
        'w-full rounded-card border-chrome border-ink bg-paper px-3 py-2.5 font-body text-sm text-ink placeholder:text-wk-faint focus:outline-none focus:ring-[3px] focus:ring-rust/25',
        className
      )}
      {...props}
    />
  )
})
