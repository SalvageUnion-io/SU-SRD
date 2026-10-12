import { Field, Textarea, tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import '../../styles/wizard.css'
import { RollTableButton } from './RollTableButton'
import type { RollTableDeps } from './rollTableHelpers.model'
import { stepColumnStyle, textSmStyle } from './wizardStyles.model'

const introStyle: CSSProperties = { ...textSmStyle, color: tokens.color.wkMuted }

type BackgroundStepProps = {
  background: string
  onChange: (value: string) => void
  /** Freeform bio / backstory (distinct from the short Background archetype). */
  description: string
  onDescriptionChange: (value: string) => void
  /** Injectable deps for testing. */
  _rollDeps?: RollTableDeps
}

/**
 * Background step — roll-table driven or freeform (slot exists in the design
 * stepper; the UI itself is undesigned, so it follows the Identity form
 * vocabulary).
 */
export function BackgroundStep({
  background,
  onChange,
  description,
  onDescriptionChange,
  _rollDeps,
}: BackgroundStepProps) {
  return (
    <div className="wiz-stack wiz-stack--20" style={stepColumnStyle}>
      <p style={introStyle}>
        Describe your pilot&apos;s background. Roll for a random prompt or write your own story.
      </p>
      <Field label="Background" htmlFor="background-field">
        <div className="wiz-stack wiz-stack--8">
          <RollTableButton
            field="background"
            onRoll={(value) => onChange(value)}
            label="Roll background"
            _deps={_rollDeps}
          />
          <Textarea
            id="background-field"
            value={background}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Where did you come from? What drives you?"
            rows={5}
          />
        </div>
      </Field>
      <Field label="Bio" htmlFor="bio-field">
        <Textarea
          id="bio-field"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Their story so far — history, motivations, notable deeds."
          rows={5}
        />
      </Field>
    </div>
  )
}
