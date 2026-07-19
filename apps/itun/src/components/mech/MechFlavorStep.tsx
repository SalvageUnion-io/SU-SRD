import { Button } from 'component-lib'
import { IdentityField } from '../sheet/IdentityField'
import type { MechRollField, MechRollTableDeps } from 'component-lib'
import { rollForMechField } from 'component-lib'

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
 * Pattern Name — plan §4.2): the sheets' IdentityField (Phase-3 review minor
 * (ii) — the wizard previews exactly the live sheet's identity idiom) plus a
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
    <div className="max-w-3xl space-y-3">
      <IdentityField
        label={label}
        value={value}
        editing
        onSave={onChange}
        multiline={multiline}
        placeholder={placeholder}
        labelAction={
          <Button size="sm" glyph="⚄" onClick={handleRoll} className="shrink-0">
            Roll
          </Button>
        }
      />
      {note && <p className="m-0 font-body text-caption text-current">{note}</p>}
    </div>
  )
}
