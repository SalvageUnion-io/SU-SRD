import { SalvageUnionReference } from 'salvageunion-reference'
import { STARTING_EQUIPMENT_BUDGET } from '../../lib/constants'
import { EntityChoiceCard } from '../shared/EntityChoiceCard'

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
  /** Injectable SUR for testing. */
  _sur?: { Equipment: SUREquipmentAccessor }
}

/**
 * Step 3: Choose starting equipment.
 * Filters to tech level 1 equipment (starting gear).
 */
export function EquipmentStep({ selectedEquipment, onToggle, _sur }: EquipmentStepProps) {
  const surEquipment = _sur?.Equipment ?? SalvageUnionReference.Equipment
  const allEquipment = surEquipment.findAll(
    (e: unknown) => (e as EquipmentLike).techLevel === 1
  ) as EquipmentLike[]
  const isAtBudget = selectedEquipment.length >= STARTING_EQUIPMENT_BUDGET

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-3">
        <p className="text-sm opacity-70">
          Choose up to {STARTING_EQUIPMENT_BUDGET} starting equipment items (Tech Level 1).
        </p>
        <span className="rounded-[2px] border border-su-black bg-su-blue-pale px-2 py-0.5 font-cond text-xs font-semibold uppercase tracking-[0.05em] text-su-black">
          {selectedEquipment.length}/{STARTING_EQUIPMENT_BUDGET} selected
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {allEquipment.map((item) => {
          const isSelected = selectedEquipment.includes(item.id)
          const isDisabled = !isSelected && isAtBudget
          return (
            <EntityChoiceCard
              key={item.id}
              entity={item}
              selected={isSelected}
              disabled={isDisabled}
              disabledReason={
                isDisabled
                  ? `Budget reached (${selectedEquipment.length}/${STARTING_EQUIPMENT_BUDGET} selected)`
                  : undefined
              }
              onSelect={() => onToggle(item.id)}
            />
          )
        })}
        {allEquipment.length === 0 && (
          <p className="text-sm opacity-60">No tech level 1 equipment found.</p>
        )}
      </div>
    </div>
  )
}
