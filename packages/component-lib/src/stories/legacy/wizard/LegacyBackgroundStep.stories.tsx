import type { Story } from '@ladle/react'
import { useState } from 'react'
import { SalvageUnionReference, rollOnTable } from 'salvageunion-reference'
import type { SURefRollTable } from 'salvageunion-reference'
import { Btn } from '../../../components/chrome/Btn'
import { Field } from '../../../components/chrome/Field'
import { Caption } from '../../_harness'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Pilot Background Step' }

/** Roll IDs for pilot wizard identity fields (mirror of ITUN rollTableHelpers). */
const PILOT_ROLL_TABLE_NAMES = {
  callsign: 'Callsign Table',
  motto: 'Motto',
  keepsake: 'Keepsake',
  appearance: 'Pilot Appearance',
  background: 'Background',
} as const

type PilotRollField = keyof typeof PILOT_ROLL_TABLE_NAMES

function rollForPilotField(field: PilotRollField): string | null {
  const table = SalvageUnionReference.RollTables.find(
    (t) => t.name === PILOT_ROLL_TABLE_NAMES[field]
  ) as (SURefRollTable & { schemaName: string }) | undefined
  if (!table) return null
  const outcome = rollOnTable(table.table, () => Math.floor(Math.random() * 20) + 1)
  if (!outcome.success) return null
  return outcome.label ? `${outcome.label}: ${outcome.value}` : outcome.value
}

/** Verbatim reproduction of ITUN's RollTableButton (RollTableButton.tsx). */
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
    <Btn size="sm" onClick={handleClick} className="shrink-0 self-center">
      <span aria-hidden="true">⚄</span> {label}
    </Btn>
  )
}

/**
 * Verbatim reproduction of the presentational shell of
 * apps/in-the-union-now/src/components/pilot/BackgroundStep.tsx (lines 20-62).
 *
 * Background step — a roll-table-assisted Background textarea plus a freeform
 * Bio textarea. Both textareas carry the same hand-rolled chrome className the
 * source declares inline.
 */
function LegacyBackgroundStep() {
  const [background, setBackground] = useState('')
  const [description, setDescription] = useState('')
  return (
    <div className="max-w-3xl space-y-5">
      <p className="text-sm text-wk-muted">
        Describe your pilot&apos;s background. Roll for a random prompt or write your own story.
      </p>
      <Field label="Background" htmlFor="background-field">
        <div className="space-y-2">
          <RollTableButton field="background" onRoll={setBackground} label="Roll background" />
          <textarea
            id="background-field"
            value={background}
            onChange={(e) => setBackground(e.target.value)}
            placeholder="Where did you come from? What drives you?"
            rows={5}
            className="w-full rounded-[3px] border-chrome border-ink bg-paper px-3 py-2.5 font-body text-sm text-ink placeholder:text-wk-faint focus:outline-none focus:ring-[3px] focus:ring-rust/[0.22]"
          />
        </div>
      </Field>
      <Field label="Bio" htmlFor="bio-field">
        <textarea
          id="bio-field"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Their story so far — history, motivations, notable deeds."
          rows={5}
          className="w-full rounded-[3px] border-chrome border-ink bg-paper px-3 py-2.5 font-body text-sm text-ink placeholder:text-wk-faint focus:outline-none focus:ring-[3px] focus:ring-rust/[0.22]"
        />
      </Field>
    </div>
  )
}

export const Default: Story = () => (
  <div className="flex flex-col gap-4">
    <Caption>
      Legacy · Pilot Background step (BackgroundStep.tsx lines 20-62) — Background (⚄ Background
      Table) + freeform Bio
    </Caption>
    <LegacyBackgroundStep />
  </div>
)
