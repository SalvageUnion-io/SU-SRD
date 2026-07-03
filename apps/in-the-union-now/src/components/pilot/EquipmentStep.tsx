import { SalvageUnionReference } from 'salvageunion-reference'
import { SelCard } from '../wizard/SelCard'
import { SelMasonry } from '../wizard/SelMasonry'

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
  selectedEquipment: string[]
  onToggle: (equipmentId: string) => void
  /**
   * Selection cap. When set (create mode) further picks beyond the budget
   * are disabled. Omit for uncapped selection (edit mode).
   */
  budget?: number
  /** Injectable SUR for testing. */
  _sur?: { Equipment: SUREquipmentAccessor }
}

/**
 * Equipment step — 3-col Sel-grid variant (design §3.2). Offers Tech Level 1
 * equipment (starting gear); creation caps picks at the starting budget while
 * edit mode is uncapped (plan 3.3 — counts beyond the creation budget allowed).
 */
export function EquipmentStep({ selectedEquipment, onToggle, budget, _sur }: EquipmentStepProps) {
  const surEquipment = _sur?.Equipment ?? SalvageUnionReference.Equipment
  const allEquipment = surEquipment.findAll(
    (e: unknown) => (e as EquipmentLike).techLevel === 1
  ) as EquipmentLike[]
  const isAtBudget = budget !== undefined && selectedEquipment.length >= budget

  return (
    <div className="w-full">
      <SelMasonry>
        {allEquipment.map((item) => {
          const isSelected = selectedEquipment.includes(item.id)
          // At-budget cards grey out; the "Max Equipment" notice lives once in
          // the WizShell footer beside the buttons.
          const isDisabled = !isSelected && isAtBudget
          return (
            <SelCard
              key={item.id}
              entity={item}
              name={item.name}
              selected={isSelected}
              disabled={isDisabled}
              onToggle={() => onToggle(item.id)}
            />
          )
        })}
      </SelMasonry>
      {allEquipment.length === 0 && (
        <p className="text-sm text-wk-muted">No tech level 1 equipment found.</p>
      )}
    </div>
  )
}
