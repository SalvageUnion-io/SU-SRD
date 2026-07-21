import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { INPUT_FOCUS } from './interaction'

type ChoiceProps = Omit<ComponentPropsWithoutRef<'input'>, 'type'> & {
  /** Primary label (bold ink) — the option's name. */
  label: ReactNode
  /** Optional secondary line (muted) — a callsign, tech level, chassis, … */
  description?: ReactNode
}

/**
 * The framed choice row shared by `Checkbox` and `Radio`: a paper card with a
 * 1.5px ink border (the same `border-chrome border-ink bg-paper` chrome `Input`
 * wears), a native `<input>` at the left, then the bold-ink label and an
 * optional muted description. Clicking anywhere on the row toggles it because
 * the whole row IS the `<label>` — native semantics, so screen readers get the
 * right role and radio groups arrow-key between options for free.
 */
const CHOICE_ROW =
  'flex cursor-pointer items-center gap-2 rounded-card border-chrome border-ink bg-paper p-2 hover:bg-wk-bg-2'

/** The native input in the form vocabulary: rust check/fill + the shared rust focus ring. */
const CHOICE_INPUT = cn('accent-rust', INPUT_FOCUS)

const ChoiceControl = forwardRef<HTMLInputElement, ChoiceProps & { type: 'checkbox' | 'radio' }>(
  function ChoiceControl({ type, label, description, className, ...props }, ref) {
    return (
      <label className={cn(CHOICE_ROW, className)}>
        <input ref={ref} type={type} className={CHOICE_INPUT} {...props} />
        <span className="font-body text-sm font-medium text-ink">{label}</span>
        {description != null && (
          <span className="font-body text-xs text-wk-muted">{description}</span>
        )}
      </label>
    )
  }
)

/**
 * Boolean checkbox in the form vocabulary (sibling of `Field`/`Input`): a real
 * `<input type="checkbox">` inside a framed `<label>` row, so the label toggles
 * it and the native square/checkmark carry the semantics. Same paper / 1.5px-ink
 * chrome and rust focus ring as `Input`.
 */
export const Checkbox = forwardRef<HTMLInputElement, ChoiceProps>(function Checkbox(props, ref) {
  return <ChoiceControl ref={ref} type="checkbox" {...props} />
})

/**
 * Single-choice radio in the form vocabulary — the `Checkbox` sibling: identical
 * framed-row chrome, differing only in the native round shape and mutually-
 * exclusive semantics (group members share a `name`; arrow keys move between
 * them natively). Use for a one-of-many selector dialog.
 */
export const Radio = forwardRef<HTMLInputElement, ChoiceProps>(function Radio(props, ref) {
  return <ChoiceControl ref={ref} type="radio" {...props} />
})
