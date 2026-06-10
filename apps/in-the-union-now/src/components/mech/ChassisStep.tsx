import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { OptRow, ReferenceEntityDisplay, SectionSeparator } from 'suref-react'

type ChassisLike = {
  id: string
  name: string
  content?: unknown
  patterns?: {
    name: string
    systems?: { name: string }[]
    modules?: { name: string }[]
  }[]
}

/** First paragraph block — used as the OptRow description line. */
function chassisDescription(chassis: ChassisLike): string | undefined {
  if (!Array.isArray(chassis.content)) return undefined
  const firstText = chassis.content.find(
    (b) =>
      typeof b === 'object' && b !== null && typeof (b as { value?: unknown }).value === 'string'
  ) as { value: string } | undefined
  return firstText?.value
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
          desc={chassisDescription(chassis)}
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
 * chassis display) and an integrated-systems head grid expanded inside the
 * card — the stock (first) pattern's systems/modules as head-mode cards in a
 * 2-col grid. The bulky patterns section is hidden in favour of that grid.
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
        Select a chassis to preview its stats and systems.
      </div>
    )
  }

  const stockPattern = chassis.patterns?.[0]
  const integrated = stockPattern
    ? [
        ...(stockPattern.systems ?? []).flatMap((s) => {
          const found = SalvageUnionReference.Systems.find((x) => x.name === s.name)
          return found
            ? [
                {
                  key: `sys-${s.name}`,
                  entity: found as unknown as SURefEntity,
                },
              ]
            : []
        }),
        ...(stockPattern.modules ?? []).flatMap((m) => {
          const found = SalvageUnionReference.Modules.find((x) => x.name === m.name)
          return found
            ? [
                {
                  key: `mod-${m.name}`,
                  entity: found as unknown as SURefEntity,
                },
              ]
            : []
        }),
      ]
    : []

  return (
    <ReferenceEntityDisplay
      data={chassis as unknown as SURefEntity}
      hide={{ patterns: true, choices: true }}
      afterExtraContent={
        integrated.length > 0 ? (
          <div className="mt-4 space-y-3">
            <SectionSeparator
              label={`Integrated Systems · ${stockPattern!.name}`}
              fontSize="text-xs"
            />
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              {integrated.map(({ key, entity }) => (
                <ReferenceEntityDisplay
                  key={key}
                  data={entity}
                  mode="head"
                  hide={{ actions: true, choices: true }}
                />
              ))}
            </div>
          </div>
        ) : undefined
      }
    />
  )
}
