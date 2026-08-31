/* Ported from packages/component-lib/src/components/wizard/EquipmentStep.stories.tsx. */
import { EquipmentStep } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../preview-lib/harness'

/** Pilot starting-equipment picker, with the budget cap applied. */
export function WithBudget() {
  return (
    <div className="sheet--pilot bg-paper p-4">
      <Caption>budget 3 — nothing picked yet</Caption>
      <EquipmentStep selectedEquipment={[]} budget={3} onToggle={() => {}} />
    </div>
  )
}

/** Partway through — the budget readout tracks what has been taken. */
export function PartlySpent() {
  const picks = SalvageUnionReference.Equipment.all()
    .slice(0, 2)
    .map((e) => e.id)
  return (
    <div className="sheet--pilot bg-paper p-4">
      <Caption>two of three taken</Caption>
      <EquipmentStep selectedEquipment={picks} budget={3} onToggle={() => {}} />
    </div>
  )
}
