import { SalvageUnionReference, nameToSlug } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'

import { matchesRef, resolveChassisRef } from '../../lib/rules/resolveRefs'
import { EmptyState, OptRow, ReferenceEntityCard } from 'component-lib'

type ChassisLike = {
  id: string
  name: string
}

type ChassisOptionListProps = {
  selectedChassis: string
  onSelect: (chassisName: string) => void
}

/**
 * Master pane for the Chassis step (design §3.2b): OptRow per chassis, the
 * active row drives the detail pane.
 */
export function ChassisOptionList({ selectedChassis, onSelect }: ChassisOptionListProps) {
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

type ChassisDetailProps = {
  chassisName: string
}

/**
 * Detail pane for the Chassis step (design §3.2c): the selected chassis's
 * full entity card with its chassis-ability compact card (built into the
 * chassis display). Patterns/loadout live in the next (Pattern) step — the
 * chassis card shows the bare chassis only.
 */
export function ChassisDetail({ chassisName }: ChassisDetailProps) {
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
    <ReferenceEntityCard
      data={chassis as unknown as SURefEntity}
      hide={{ patterns: true, choices: true }}
    />
  )
}
