import { Button, Field, tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import '../../styles/wizard.css'
import type { MechRollField, MechRollTableDeps } from './mechRollTables.model'
import { rollForMechField } from './mechRollTables.model'
import { stepColumnStyle } from './wizardStyles.model'

const rollButtonStyle = { flexShrink: 0 } satisfies CSSProperties

const noteStyle = {
  color: 'currentcolor',
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  margin: 0,
} satisfies CSSProperties

type MechFlavorStepProps = {
  /** Which flavor fact this step edits (also picks the d20 roll table). */
  field: MechRollField
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Appearance uses the multiline IdentityField; the rest a single line. */
  multiline?: boolean
  /** Optional helper line under the field (e.g. the name-IS-pattern note). */
  note?: string
  /** Injectable roll deps for testing. */
  _rollDeps?: MechRollTableDeps
}

/**
 * Featherweight mech flavor step (Mech Workshop steps 6–8: Quirk, Appearance,
 * Pattern Name): the sheets' IdentityField (the wizard previews exactly the
 * live sheet's identity idiom) plus a
 * d20 roll-table assist. The roll result writes into the field and stays
 * editable — roll is an assist, never a commitment.
 */
export function MechFlavorStep({
  field,
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  note,
  _rollDeps,
}: MechFlavorStepProps) {
  function handleRoll() {
    const result = rollForMechField(field, _rollDeps)
    if (result !== null) onChange(result)
  }

  return (
    <div className="su-wiz-stack su-wiz-stack--12" style={stepColumnStyle}>
      <Field
        label={label}
        value={value}
        onSave={onChange}
        multiline={multiline}
        placeholder={placeholder}
        labelAction={
          <Button size="compact" glyph="⚄" onClick={handleRoll} style={rollButtonStyle}>
            Roll
          </Button>
        }
      />
      {note && <p style={noteStyle}>{note}</p>}
    </div>
  )
}
