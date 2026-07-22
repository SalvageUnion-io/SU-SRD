import { SalvageUnionReference, nameToSlug } from 'salvageunion-reference'

import { matchesRef, resolveChassisRef } from '../../lib/rules/resolveRefs'
import { EmptyState, ReferenceEntityCard } from 'component-lib'

type ChassisOptionListProps = {
  selectedChassis: string
  onSelect: (chassisName: string) => void
}

/**
 * Master pane for the Chassis step (design §3.2b): each chassis rendered as its
 * own reference card at catalog extent (artwork + name + description), the
 * checked card driving the detail pane. Exactly one is chosen, so the pane is a
 * `radiogroup` and each card announces `aria-checked`.
 */
export function ChassisOptionList({ selectedChassis, onSelect }: ChassisOptionListProps) {
  const allChassis = SalvageUnionReference.Chassis.all()
  return (
    <div role="radiogroup" aria-label="Chassis">
      {allChassis.map((chassis) => (
        <ReferenceEntityCard
          key={chassis.id}
          data={chassis}
          size="medium"
          extent="catalog"
          className="mb-2"
          selected={matchesRef(chassis, selectedChassis)}
          selectionRole="radio"
          cardClickLabel={chassis.name}
          onCardClick={() => onSelect(nameToSlug(chassis.name))}
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
  const chassis = chassisName ? (resolveChassisRef(chassisName) ?? undefined) : undefined

  if (!chassis) {
    return (
      <EmptyState
        className="h-full"
        headline="No Chassis Selected"
        body="Select a chassis to preview its stats."
      />
    )
  }

  return <ReferenceEntityCard data={chassis} hide={{ patterns: true, choices: true }} />
}
