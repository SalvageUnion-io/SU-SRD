import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { isLegalCreationEquipment } from 'salvageunion-reference/rules'
import { MasonryColumns } from '../shared/MasonryColumns'
import { ReferenceEntityCard } from '../referenceEntity/card/ReferenceEntityCard'

type SUREquipmentAccessor = {
  findAll: (fn: (x: unknown) => boolean) => unknown[]
}

type EquipmentLike = {
  id: string
  name: string
  techLevel: number
  actions: string[]
}

type EquipmentStepProps = {
  /** Picked ids — duplicates allowed in create mode (one entry per copy). */
  selectedEquipment: string[]
  /** Edit mode: toggle an item in/out (uncapped, single copy per id). */
  onToggle: (equipmentId: string) => void
  /** Create mode: set the count of copies for an id (count-stepper). */
  onCountChange?: (equipmentId: string, next: number) => void
  /**
   * Selection cap. When set (create mode) the step runs the count-stepper
   * regime clamped at the budget. Omit for uncapped toggling (edit mode).
   */
  budget?: number
  /** Injectable SUR for testing. */
  _sur?: { Equipment: SUREquipmentAccessor }
}

/**
 * Step 3 · Choose your Equipment (Pilot Bay p.19). Create mode is HARD
 * (plan §4.1): only Tech 1 equipment renders (package
 * `isLegalCreationEquipment` — higher TLs are never shown), exactly `budget`
 * (2) picks via per-card count-steppers, DUPLICATES ALLOWED; at the budget
 * every `+` disables (cards stay legible, never dimmed). Edit mode lifts the
 * filters: every tech level, uncapped toggle (the soft regime).
 */
export function EquipmentStep({
  selectedEquipment,
  onToggle,
  onCountChange,
  budget,
  _sur,
}: EquipmentStepProps) {
  const surEquipment = _sur?.Equipment ?? SalvageUnionReference.Equipment
  const isCreate = budget !== undefined

  const equipment = (
    isCreate
      ? surEquipment.findAll((e: unknown) => isLegalCreationEquipment(e as EquipmentLike))
      : surEquipment.findAll(() => true)
  ) as EquipmentLike[]
  const sorted = isCreate
    ? equipment
    : [...equipment].sort((a, b) => a.techLevel - b.techLevel || a.name.localeCompare(b.name))

  // Copies picked per id (create mode allows duplicates).
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
              <ReferenceEntityCard
                key={item.id}
                data={item as unknown as SURefEntity}
                compact
                selected={count >= 1}
                selectionRole="toggle"
                cardClickLabel={item.name}
                // Card click adds a copy while the budget allows.
                onCardClick={() => {
                  if (remaining > 0) onCountChange?.(item.id, count + 1)
                }}
                hide={{ actions: true, choices: true }}
                controls={[
                  {
                    key: 'qty',
                    stepper: {
                      subject: item.name,
                      count,
                      max: count + remaining,
                      onChange: (next) => onCountChange?.(item.id, next),
                    },
                  },
                ]}
              />
            )
          }
          return (
            <ReferenceEntityCard
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
