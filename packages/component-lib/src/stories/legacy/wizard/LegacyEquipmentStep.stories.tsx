import type { Story } from '@ladle/react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { isLegalCreationEquipment } from 'salvageunion-reference/rules'
import { CountStepper } from '../../../components/chrome/CountStepper'
import { ReferenceEntityDisplay } from '../../../components/referenceEntity/card/referenceEntityDisplayShim'
import { MasonryColumns } from '../../../components/shared/MasonryColumns'
import { Caption } from '../../_harness'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Wizard/Pilot Equipment Step' }

type EquipmentLike = {
  id: string
  name: string
  techLevel: number
  actions: string[]
}

/**
 * Verbatim reproduction of the presentational shell of
 * apps/in-the-union-now/src/components/pilot/EquipmentStep.tsx (lines 41-119).
 *
 * Step 3 · Choose your Equipment. Create mode is HARD: only Tech 1 equipment
 * renders (package `isLegalCreationEquipment`), exactly `budget` (2) picks via
 * per-card count-steppers, DUPLICATES ALLOWED; at the budget every `+`
 * disables. Edit mode lifts the filters: every tech level, uncapped toggle.
 */
function LegacyEquipmentStep({ budget }: { budget?: number }) {
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([])
  const isCreate = budget !== undefined

  const onToggle = (equipmentId: string) => {
    setSelectedEquipment((prev) =>
      prev.includes(equipmentId) ? prev.filter((id) => id !== equipmentId) : [...prev, equipmentId]
    )
  }
  const onCountChange = (equipmentId: string, next: number) => {
    setSelectedEquipment((prev) => {
      const others = prev.filter((id) => id !== equipmentId)
      return [...others, ...Array.from({ length: next }, () => equipmentId)]
    })
  }

  const surEquipment = SalvageUnionReference.Equipment
  const equipment = (
    isCreate
      ? surEquipment.findAll((e: unknown) => isLegalCreationEquipment(e as EquipmentLike))
      : surEquipment.findAll(() => true)
  ) as EquipmentLike[]
  const sorted = isCreate
    ? equipment
    : [...equipment].sort((a, b) => a.techLevel - b.techLevel || a.name.localeCompare(b.name))

  const counts = new Map<string, number>()
  for (const id of selectedEquipment) {
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  const totalPicked = selectedEquipment.length
  const remaining = isCreate ? Math.max(0, budget - totalPicked) : 0

  return (
    <div className="w-full">
      <MasonryColumns maxColumns={2}>
        {sorted.map((item) => {
          const count = counts.get(item.id) ?? 0
          if (isCreate) {
            return (
              <ReferenceEntityDisplay
                key={item.id}
                data={item as unknown as SURefEntity}
                compact
                selected={count >= 1}
                selectionRole="toggle"
                cardClickLabel={item.name}
                onCardClick={() => {
                  if (remaining > 0) onCountChange(item.id, count + 1)
                }}
                hide={{ actions: true, choices: true }}
                footActions={
                  <CountStepper
                    subject={item.name}
                    count={count}
                    max={count + remaining}
                    onChange={(next) => onCountChange(item.id, next)}
                  />
                }
              />
            )
          }
          return (
            <ReferenceEntityDisplay
              key={item.id}
              data={item as unknown as SURefEntity}
              compact
              selected={selectedEquipment.includes(item.id)}
              selectionRole="toggle"
              cardClickLabel={item.name}
              onCardClick={() => onToggle(item.id)}
              hide={{ actions: true, choices: true }}
            />
          )
        })}
      </MasonryColumns>
      {sorted.length === 0 && (
        <p className="text-sm text-wk-muted">
          {isCreate ? 'No tech level 1 equipment found.' : 'No equipment found.'}
        </p>
      )}
    </div>
  )
}

export const Default: Story = () => (
  <div className="flex flex-col gap-4">
    <Caption>
      Legacy · Pilot Equipment step, create mode (EquipmentStep.tsx lines 41-119) — Tech 1 only,
      budget 2, per-card count-steppers, duplicates allowed
    </Caption>
    <LegacyEquipmentStep budget={2} />
  </div>
)

export const EditMode: Story = () => (
  <div className="flex flex-col gap-4">
    <Caption>
      Legacy · Equipment step, edit mode — every tech level, uncapped toggle (single copy per id)
    </Caption>
    <LegacyEquipmentStep />
  </div>
)
