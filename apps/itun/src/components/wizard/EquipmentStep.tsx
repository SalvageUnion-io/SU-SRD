import { EmptyState, MasonryColumns, ReferenceEntityCard } from 'component-lib'
import type { SURefEquipment } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { isLegalCreationEquipment } from 'salvageunion-reference/rules'

type SUREquipmentAccessor = {
  findAll: (fn: (x: unknown) => boolean) => unknown[]
}

type EquipmentStepProps = {
  /** Picked ids — duplicates allowed (one entry per copy). */
  selectedEquipment: string[]
  /** Set the count of copies for an id (count-stepper). */
  onCountChange: (equipmentId: string, next: number) => void
  /** Selection cap: the total picks the count-steppers are clamped at. */
  budget: number
  /** Injectable SUR for testing. */
  _sur?: { Equipment: SUREquipmentAccessor }
}

/**
 * Step 3 · Choose your Equipment (Pilot Bay p.19), enforced HARD (plan
 * §4.1): only Tech 1 equipment renders (package `isLegalCreationEquipment` —
 * higher TLs are never shown), exactly `budget` (2) picks via per-card
 * count-steppers, DUPLICATES ALLOWED; at the budget every `+` disables (cards
 * stay legible, never dimmed).
 */
export function EquipmentStep({
  selectedEquipment,
  onCountChange,
  budget,
  _sur,
}: EquipmentStepProps) {
  const surEquipment = _sur?.Equipment ?? SalvageUnionReference.Equipment

  // The injectable accessor is `unknown`-typed for test seams (itun's
  // PilotWizard passes the same shape), so the ONE cast lives here at the
  // seam: the production accessor really returns `SURefEquipment[]`, and a
  // properly-typed item then flows into the card with no further forcing.
  const equipment = surEquipment.findAll((e: unknown) =>
    isLegalCreationEquipment(e as SURefEquipment)
  ) as SURefEquipment[]

  // Copies picked per id (duplicates allowed).
  const counts = new Map<string, number>()
  for (const id of selectedEquipment) {
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  const totalPicked = selectedEquipment.length
  const remaining = Math.max(0, budget - totalPicked)

  return (
    <div className="w-full">
      <MasonryColumns maxColumns={2}>
        {equipment.map((item) => {
          const count = counts.get(item.id) ?? 0
          return (
            <ReferenceEntityCard
              key={item.id}
              data={item}
              size="medium"
              selected={count >= 1}
              selectionRole="toggle"
              cardClickLabel={item.name}
              // Card click adds a copy while the budget allows.
              onCardClick={() => {
                if (remaining > 0) onCountChange(item.id, count + 1)
              }}
              hide={{ actions: true, choices: true }}
              controls={[
                {
                  key: 'qty',
                  stepper: {
                    subject: item.name,
                    count,
                    max: count + remaining,
                    onChange: (next) => onCountChange(item.id, next),
                  },
                },
              ]}
            />
          )
        })}
      </MasonryColumns>
      {equipment.length === 0 && (
        <EmptyState headline="No Equipment" body="No tech level 1 equipment found." />
      )}
    </div>
  )
}
