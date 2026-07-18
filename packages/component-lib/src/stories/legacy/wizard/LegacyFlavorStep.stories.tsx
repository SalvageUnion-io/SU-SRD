import type { Story } from '@ladle/react'
import { useState } from 'react'
import { SalvageUnionReference, rollOnTable } from 'salvageunion-reference'
import type { SURefRollTable } from 'salvageunion-reference'
import { Button } from '../../../components/chrome/Button'
import { Field, Input } from '../../../components/chrome/Field'
import { Caption } from '../../_harness'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Wizard/Pilot Flavor Step' }

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
    <Button size="sm" onClick={handleClick} className="shrink-0 self-center">
      <span aria-hidden="true">⚄</span> {label}
    </Button>
  )
}

/**
 * Verbatim reproduction of the presentational shell of
 * apps/in-the-union-now/src/components/pilot/FlavorStep.tsx (lines 24-68).
 *
 * Featherweight optional-flavor step (Motto / Keepsake / Appearance): one field
 * + its d20 roll-table assist. Appearance is multiline (textarea + hand-rolled
 * chrome), motto/keepsake single-line (Input + inline roll button).
 */
function LegacyFlavorStep({
  field,
  label,
  placeholder,
  multiline = false,
}: {
  field: Extract<PilotRollField, 'motto' | 'keepsake' | 'appearance'>
  label: string
  placeholder: string
  multiline?: boolean
}) {
  const [value, setValue] = useState('')
  const id = `pilot-${field}`
  return (
    <div className="max-w-3xl space-y-5">
      <Field label={label} htmlFor={id}>
        {multiline ? (
          <div className="space-y-2">
            <RollTableButton
              field={field}
              onRoll={setValue}
              label={`Roll ${label.toLowerCase()}`}
            />
            <textarea
              id={id}
              value={value}
              onChange={(e) => setValue(e.target.value)}
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
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
            />
            <RollTableButton field={field} onRoll={setValue} />
          </div>
        )}
      </Field>
    </div>
  )
}

export const Default: Story = () => (
  <div className="flex flex-col gap-8">
    <Caption>
      Legacy · Pilot Flavor step (FlavorStep.tsx lines 24-68) — one field + ⚄ assist
    </Caption>
    <div>
      <Caption>Motto — single-line (inline roll button)</Caption>
      <LegacyFlavorStep field="motto" label="Motto" placeholder="A line you live by" />
    </div>
    <div>
      <Caption>Keepsake — single-line</Caption>
      <LegacyFlavorStep field="keepsake" label="Keepsake" placeholder="Something you carry" />
    </div>
    <div>
      <Caption>Appearance — multiline (textarea + stacked roll button)</Caption>
      <LegacyFlavorStep
        field="appearance"
        label="Appearance"
        placeholder="What do they look like?"
        multiline
      />
    </div>
  </div>
)
