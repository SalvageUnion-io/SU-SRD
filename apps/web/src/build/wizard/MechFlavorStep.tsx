import type { CSSProperties } from 'react'
import { tokens } from '../../components/index'
import { RollTableButton } from './RollTableButton'
import type { MechRollField, RollTableDeps } from './rollTableHelpers.model'
import { MECH_ROLL_TABLE_NAMES } from './rollTableHelpers.model'
import { WizTextField } from './WizTextField'
import { stepColumnStyle } from './wizardStyles.model'

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
  /** Appearance is a multiline field; the rest a single line. */
  multiline?: boolean
  /** Optional helper line under the field (e.g. the name-IS-pattern note). */
  note?: string
  /** Enter in the field: the step's own act (r8 E8). */
  onEnter?: (() => void) | undefined
  /** Injectable roll deps for testing. */
  _deps?: RollTableDeps
}

/**
 * Featherweight mech flavor step (Mech Workshop steps 6–8: Quirk, Appearance,
 * Pattern Name): a live text field (`WizTextField`, saved as typed) plus a
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
  onEnter,
  _deps,
}: MechFlavorStepProps) {
  return (
    <div className="su-wiz-stack su-wiz-stack--12" style={stepColumnStyle}>
      <WizTextField
        label={label}
        value={value}
        onChange={onChange}
        multiline={multiline}
        placeholder={placeholder}
        onEnter={onEnter}
        labelAction={
          <RollTableButton table={MECH_ROLL_TABLE_NAMES[field]} onRoll={onChange} _deps={_deps} />
        }
      />
      {note && <p style={noteStyle}>{note}</p>}
    </div>
  )
}
