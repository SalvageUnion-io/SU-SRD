import { Field, Input } from 'component-lib'
import type { PilotRollField, RollTableDeps } from './rollTableHelpers'
import { RollTableButton } from './RollTableButton'

type FlavorStepProps = {
  /** Which optional flavor fact this step edits (also the roll table). */
  field: Extract<PilotRollField, 'motto' | 'keepsake' | 'appearance'>
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  /** Appearance uses a textarea; motto/keepsake a single-line input. */
  multiline?: boolean
  /** Injectable deps for testing. */
  _rollDeps?: RollTableDeps
}

/**
 * Featherweight optional-flavor step (Pilot Bay steps 6–8: Motto, Keepsake,
 * Appearance — plan §4.1/Q10): one field + its d20 roll-table assist. Nothing
 * is enforced — flavor is optional, Next is always enabled — and the roll
 * result stays editable (roll is an assist, never a commitment).
 */
export function FlavorStep({
  field,
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  _rollDeps,
}: FlavorStepProps) {
  const id = `pilot-${field}`
  return (
    <div className="max-w-3xl space-y-5">
      <Field label={label} htmlFor={id}>
        {multiline ? (
          <div className="space-y-2">
            <RollTableButton
              field={field}
              onRoll={onChange}
              label={`Roll ${label.toLowerCase()}`}
              _deps={_rollDeps}
            />
            <textarea
              id={id}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              rows={5}
              className="w-full rounded-[3px] border-chrome border-ink bg-paper px-3 py-2.5 font-body text-sm text-ink placeholder:text-wk-faint focus:outline-none focus:ring-[3px] focus:ring-rust/[0.22]"
            />
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              id={id}
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
            />
            <RollTableButton field={field} onRoll={onChange} _deps={_rollDeps} />
          </div>
        )}
      </Field>
    </div>
  )
}
