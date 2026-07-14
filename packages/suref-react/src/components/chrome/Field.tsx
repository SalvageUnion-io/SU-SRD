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
    <div className={cn('block', className)}>
      <label htmlFor={htmlFor} className="mb-1.5 flex w-fit items-center gap-1">
        {/* The field label IS the ink Stamp (canonical label atom). */}
        <Text variant="pseudoheader" as="span" className="text-[11px]">
          {label}
        </Text>
        {required && (
          <span aria-hidden="true" className="font-cond text-[13px] font-bold text-rust">
            *
          </span>
        )}
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
        'w-full rounded-[3px] border-chrome border-ink bg-paper px-3 py-2.5 font-body text-sm text-ink placeholder:text-wk-faint focus:outline-none focus:ring-[3px] focus:ring-rust/[0.22]',
        className
      )}
      {...props}
    />
  )
})
