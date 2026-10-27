import { Field, Input, Textarea } from '../../components/index'
import { buildWizardCopy } from '../../messages/build-wizard'
import { RollTableButton } from './RollTableButton'
import type { PilotRollField, RollTableDeps } from './rollTableHelpers.model'
import { fieldRowStyle, stepColumnStyle } from './wizardStyles.model'

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
 * Appearance): one field + its d20 roll-table assist. Nothing
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
    <div className="su-wiz-stack su-wiz-stack--20" style={stepColumnStyle}>
      <Field label={label} htmlFor={id}>
        {multiline ? (
          <div className="su-wiz-stack su-wiz-stack--8">
            <RollTableButton
              field={field}
              onRoll={onChange}
              label={buildWizardCopy('roll', { lowerCase: label.toLowerCase() })}
              _deps={_rollDeps}
            />
            <Textarea
              id={id}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              rows={5}
            />
          </div>
        ) : (
          <div style={fieldRowStyle}>
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
