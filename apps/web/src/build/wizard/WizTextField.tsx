import type { ReactNode } from 'react'
import { useId } from 'react'
import { Field, Input, Textarea } from '../../components/index'

type WizTextFieldProps = {
  label: string
  value: string
  /** Called on every keystroke: the draft holds what is typed as it is typed. */
  onChange: (next: string) => void
  placeholder?: string | undefined
  multiline?: boolean
  required?: boolean
  /** The control's name when the label alone is ambiguous ("Pilot name"). */
  ariaLabel?: string
  /** A control on the label's line: the d20 Roll assist. */
  labelAction?: ReactNode
  /** Enter in a one-line field: the step's own act (Create Mech, r8 E8). */
  onEnter?: (() => void) | undefined
}

/**
 * A wizard's text field: a live `Input` (a `Textarea` when `multiline`) under
 * its label, as the pilot wizard's Callsign is. Every keystroke reaches the
 * draft, so a step's Next or Create is ready the moment the field is filled,
 * never only after a blur.
 */
export function WizTextField({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  required = false,
  ariaLabel,
  labelAction,
  onEnter,
}: WizTextFieldProps) {
  const id = useId()
  return (
    <Field label={label} required={required} htmlFor={id} labelAction={labelAction}>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          rows={4}
          aria-label={ariaLabel}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          id={id}
          type="text"
          value={value}
          aria-label={ariaLabel}
          placeholder={placeholder}
          required={required}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={
            onEnter &&
            ((e) => {
              if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
              e.preventDefault()
              onEnter()
            })
          }
        />
      )}
    </Field>
  )
}
