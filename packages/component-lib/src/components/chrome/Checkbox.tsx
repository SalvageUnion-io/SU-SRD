import type { ComponentPropsWithRef, ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { INPUT_FOCUS } from './interaction'

type ChoiceProps = Omit<ComponentPropsWithRef<'input'>, 'type'> & {
  /** Primary label (bold ink) — the option's name. */
  label: ReactNode
  /** Optional secondary line (muted) — a callsign, tech level, chassis, … */
  description?: ReactNode
  /**
   * Stack the bold label over its hint (a column) instead of setting them side
   * by side, and mark the chosen option with a 2px ink border. The pattern
   * visibility picker uses it: side by side, a narrow phone wraps the label
   * one word per line.
   */
  stacked?: boolean
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
  'flex cursor-pointer items-center gap-2 rounded-card border-chrome border-ink bg-paper p-2 hover:bg-ink-8'

/** The native input in the form vocabulary: ink check/fill + the shared focus ring. */
const CHOICE_INPUT = cn('accent-ink', INPUT_FOCUS)

function ChoiceControl({
  type,
  label,
  description,
  stacked = false,
  className,
  ...props
}: ChoiceProps & { type: 'checkbox' | 'radio' }) {
  const text = (
    <>
      <span className={cn('font-body text-sm text-ink', stacked ? 'font-bold' : 'font-medium')}>
        {label}
      </span>
      {description != null && (
        <span className="font-body text-xs text-wk-muted">{description}</span>
      )}
    </>
  )
  return (
    <label
      className={cn(
        CHOICE_ROW,
        stacked && 'items-start has-[:checked]:border-2 has-[:checked]:p-[calc(0.5rem-0.5px)]',
        className
      )}
    >
      <input type={type} className={cn(CHOICE_INPUT, stacked && 'mt-0.5')} {...props} />
      {stacked ? <span className="flex min-w-0 flex-col gap-0.5">{text}</span> : text}
    </label>
  )
}

/**
 * Boolean checkbox in the form vocabulary (sibling of `Field`/`Input`): a real
 * `<input type="checkbox">` inside a framed `<label>` row, so the label toggles
 * it and the native square/checkmark carry the semantics. Same paper / 1.5px-ink
 * chrome and focus ring as `Input`.
 */
export function Checkbox(props: ChoiceProps) {
  return <ChoiceControl type="checkbox" {...props} />
}

/**
 * Single-choice radio in the form vocabulary — the `Checkbox` sibling: identical
 * framed-row chrome, differing only in the native round shape and mutually-
 * exclusive semantics (group members share a `name`; arrow keys move between
 * them natively). Use for a one-of-many selector dialog.
 */
export function Radio(props: ChoiceProps) {
  return <ChoiceControl type="radio" {...props} />
}
