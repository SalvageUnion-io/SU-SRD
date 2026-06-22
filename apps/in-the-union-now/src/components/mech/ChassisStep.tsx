import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { OptRow, ReferenceEntityDisplay } from 'suref-react'

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
          active={chassis.name === selectedChassis}
          onClick={() => onSelect(chassis.name)}
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
    ? (SalvageUnionReference.Chassis.find((c) => c.name === chassisName) as unknown as
        | ChassisLike
        | undefined)
    : undefined

  if (!chassis) {
    return (
      <div className="flex h-full min-h-40 items-center justify-center rounded-[3px] border-[1.5px] border-dashed border-wk-faint p-6 text-center text-sm text-wk-muted">
        Select a chassis to preview its stats.
      </div>
    )
  }

  return (
    <ReferenceEntityDisplay
      data={chassis as unknown as SURefEntity}
      hide={{ patterns: true, choices: true }}
    />
  )
}
