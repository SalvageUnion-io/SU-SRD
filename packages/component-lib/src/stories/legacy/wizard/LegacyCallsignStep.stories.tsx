import type { Story } from '@ladle/react'
import { useState } from 'react'
import { SalvageUnionReference, rollOnTable } from 'salvageunion-reference'
import type { SURefRollTable } from 'salvageunion-reference'
import { Button } from '../../../components/chrome/Button'
import { Field, Input } from '../../../components/chrome/Field'
import { Caption } from '../../_harness'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Wizard/Pilot Callsign Step' }

/** Roll IDs for pilot wizard identity fields (mirror of ITUN rollTableHelpers). */
const PILOT_ROLL_TABLE_NAMES = {
  callsign: 'Callsign Table',
  motto: 'Motto',
  keepsake: 'Keepsake',
  appearance: 'Pilot Appearance',
  background: 'Background',
} as const

type PilotRollField = keyof typeof PILOT_ROLL_TABLE_NAMES

/**
 * Mirror of ITUN rollForPilotField — rolls a d20 on the real reference roll
 * table for the field and returns the outcome string. Uses a plain Math.random
 * d20 in place of @randsum/roller (the story cannot depend on app packages).
 */
function rollForPilotField(field: PilotRollField): string | null {
  const table = SalvageUnionReference.RollTables.find(
    (t) => t.name === PILOT_ROLL_TABLE_NAMES[field]
  ) as (SURefRollTable & { schemaName: string }) | undefined
  if (!table) return null
  const outcome = rollOnTable(table.table, () => Math.floor(Math.random() * 20) + 1)
  if (!outcome.success) return null
  return outcome.label ? `${outcome.label}: ${outcome.value}` : outcome.value
}

/**
 * Verbatim reproduction of ITUN's RollTableButton
 * (apps/in-the-union-now/src/components/pilot/RollTableButton.tsx) — a `Button`
 * with the ⚄ glyph that fires the field's roll table.
 */
function RollTableButton({
  field,
  onRoll,
  label = 'Roll',
}: {
  field: PilotRollField
  onRoll: (value: string) => void
  label?: string
}) {
  function handleClick() {
    const result = rollForPilotField(field)
    if (result !== null) onRoll(result)
  }
  return (
    <Button size="sm" onClick={handleClick} className="shrink-0 self-center">
      <span aria-hidden="true">⚄</span> {label}
    </Button>
  )
}

/**
 * Verbatim reproduction of the presentational shell of
 * apps/in-the-union-now/src/components/pilot/CallsignStep.tsx (lines 19-51).
 *
 * Step 4 · Name (required) + Callsign (required, with the d20 Callsign Table
 * roller assist). Driven here by local state + the real reference roll table.
 */
function LegacyCallsignStep() {
  const [name, setName] = useState('')
  const [callsign, setCallsign] = useState('')
  return (
    <div className="max-w-3xl space-y-5">
      <Field label="Name" required htmlFor="pilot-name">
        <Input
          id="pilot-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your pilot's real name"
          required
        />
      </Field>
      <Field label="Callsign" required htmlFor="pilot-callsign">
        <div className="flex gap-2">
          <Input
            id="pilot-callsign"
            type="text"
            value={callsign}
            onChange={(e) => setCallsign(e.target.value)}
            placeholder="Your pilot callsign"
            required
          />
          <RollTableButton field="callsign" onRoll={setCallsign} />
        </div>
      </Field>
    </div>
  )
}

export const Default: Story = () => (
  <div className="flex flex-col gap-4">
    <Caption>
      Legacy · Pilot Callsign step (CallsignStep.tsx lines 19-51) — Name + Callsign, ⚄ rolls the
      real Callsign Table
    </Caption>
    <LegacyCallsignStep />
  </div>
)
