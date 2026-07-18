import type { Story } from '@ladle/react'
import { useState } from 'react'
import { SalvageUnionReference, nameToSlug } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { matchesRef, resolveChassisRef } from 'salvageunion-reference/rules'
import { EmptyState } from '../../../components/chrome/EmptyState'
import { OptRow } from '../../../components/chrome/OptRow'
import { ReferenceEntityDisplay } from '../../../components/referenceEntity/card/referenceEntityDisplayShim'
import { Caption } from '../../_harness'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Wizard/Mech Chassis Step (Master-Detail)' }

// Local mirror of the app-only shapes used by ChassisStep.tsx (lines 7-15).
type ChassisLike = {
  id: string
  name: string
}

/**
 * Master pane — verbatim from ChassisStep.tsx `ChassisOptionList` (lines 21-35):
 * one OptRow per chassis, the active row drives the detail pane.
 */
function ChassisOptionList({
  selectedChassis,
  onSelect,
}: {
  selectedChassis: string
  onSelect: (chassisName: string) => void
}) {
  const allChassis = SalvageUnionReference.Chassis.all() as unknown as ChassisLike[]
  return (
    <div>
      {allChassis.map((chassis) => (
        <OptRow
          key={chassis.id}
          name={chassis.name}
          active={matchesRef(chassis, selectedChassis)}
          onClick={() => onSelect(nameToSlug(chassis.name))}
        />
      ))}
    </div>
  )
}

/**
 * Detail pane — verbatim from ChassisStep.tsx `ChassisDetail` (lines 47-68):
 * the selected chassis's full entity card, or an EmptyState when unchosen.
 */
function ChassisDetail({ chassisName }: { chassisName: string }) {
  const chassis = chassisName
    ? ((resolveChassisRef(chassisName) ?? undefined) as unknown as ChassisLike | undefined)
    : undefined

  if (!chassis) {
    return (
      <EmptyState
        className="h-full"
        headline="No Chassis Selected"
        body="Select a chassis to preview its stats."
      />
    )
  }

  return (
    <ReferenceEntityDisplay
      data={chassis as unknown as SURefEntity}
      hide={{ patterns: true, choices: true }}
    />
  )
}

/**
 * Composed master-detail layout for the Chassis step (design §3.2b/c). ITUN
 * wires the two exported panes into the wizard's master-detail skeleton; this
 * story pairs them with local state so the OptRow selection drives the card.
 */
export const Default: Story = () => {
  const first = SalvageUnionReference.Chassis.all()[0]
  const [selected, setSelected] = useState(first ? nameToSlug(first.name) : '')

  return (
    <div className="flex flex-col gap-4">
      <Caption>
        Legacy · Chassis step master-detail (ITUN ChassisStep, lines 21-68) — OptRow list drives the
        detail card. Click a row.
      </Caption>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <ChassisOptionList selectedChassis={selected} onSelect={setSelected} />
        <ChassisDetail chassisName={selected} />
      </div>
    </div>
  )
}

export const NoneSelected: Story = () => (
  <div className="flex flex-col gap-4">
    <Caption>Legacy · Chassis step, empty detail pane (ChassisDetail no-selection branch)</Caption>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <ChassisOptionList selectedChassis="" onSelect={() => {}} />
      <ChassisDetail chassisName="" />
    </div>
  </div>
)
