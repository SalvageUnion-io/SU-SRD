import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { Badge } from './Badge'
import { INPUT_FOCUS } from './interaction'
import { STAMP_SEAM } from './stampSeam'

type FieldProps = {
  label: ReactNode
  /** Required asterisk inside the label stamp (white on ink) */
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
      <label htmlFor={htmlFor} className={cn(STAMP_SEAM, 'left-2 flex w-fit items-center')}>
        <Badge shape="stamp" size="mini">
          {label}
          {required && (
            <span aria-hidden="true" className="ml-0.5">
              *
            </span>
          )}
        </Badge>
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
        'w-full rounded-card border-chrome border-ink bg-paper px-3 py-2.5 font-body text-sm text-ink placeholder:text-wk-faint',
        INPUT_FOCUS,
        className
      )}
      {...props}
    />
  )
})

type TextareaProps = ComponentPropsWithoutRef<'textarea'>

/**
 * Multiline text input (design-spec §2.5): the `Input` sibling — identical
 * paper / 1.5px-ink / 3px-radius / rust-ring skin, with vertical resize.
 * `Field`-wrappable exactly like `Input`. Distinct from `InlineEditField`'s
 * internal textarea (that one is a click-to-edit control, this is a plain field).
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, rows = 3, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'w-full resize-y rounded-card border-chrome border-ink bg-paper px-3 py-2.5 font-body text-sm text-ink placeholder:text-wk-faint',
        INPUT_FOCUS,
        className
      )}
      {...props}
    />
  )
})

type SelectProps = ComponentPropsWithoutRef<'select'> & {
  /**
   * Faux-select rung: strip the native disclosure (`appearance-none`) and draw a
   * consistent ink chevron inside the field. This is the one sanctioned way to
   * customise the affordance — a caller that wants the styled arrow opts in here
   * rather than re-typing the skin with its own absolute-positioned glyph.
   */
  chevron?: boolean
}

/**
 * Native `<select>` in the `Input` skin (design-spec §2.5): the app's
 * hand-copied `SELECT_CLASS` promoted to a real atom — same paper / 1.5px-ink /
 * 3px-radius / rust-ring chrome as `Input`, `Field`-wrappable, keeping the
 * native disclosure affordance. Compact call-sites pass `px-2 py-1.5` via
 * `className`; `chevron` swaps the native arrow for the styled faux-select one.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, chevron = false, ...props },
  ref
) {
  const select = (
    <select
      ref={ref}
      className={cn(
        'w-full min-h-11 rounded-card border-chrome border-ink bg-paper px-3 py-2.5 font-body text-sm text-ink',
        INPUT_FOCUS,
        chevron && 'cursor-pointer appearance-none pr-8',
        className
      )}
      {...props}
    />
  )
  if (!chevron) return select
  return (
    <span className="relative inline-block">
      {select}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-wk-muted"
      >
        ▾
      </span>
    </span>
  )
})
