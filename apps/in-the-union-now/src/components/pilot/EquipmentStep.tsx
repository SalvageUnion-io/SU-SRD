import { SalvageUnionReference } from 'salvageunion-reference'

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

/** Max starting equipment items per Salvage Union character creation rules. */
const STARTING_EQUIPMENT_BUDGET = 3

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
    <div className="space-y-4">
      <p className="text-sm opacity-70">
        Choose up to {STARTING_EQUIPMENT_BUDGET} starting equipment items (Tech Level 1).{' '}
        <span className="font-medium">
          {selectedEquipment.length}/{STARTING_EQUIPMENT_BUDGET} selected
        </span>
      </p>
      <div className="grid gap-2">
        {allEquipment.map((item) => {
          const isSelected = selectedEquipment.includes(item.id)
          const isDisabled = !isSelected && isAtBudget

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => !isDisabled && onToggle(item.id)}
              disabled={isDisabled}
              aria-pressed={isSelected}
              className={[
                'w-full rounded-md border p-3 text-left text-sm transition-colors',
                isSelected
                  ? 'border-primary bg-primary/10'
                  : isDisabled
                    ? 'cursor-not-allowed border-border opacity-40'
                    : 'border-border hover:border-primary/50 hover:bg-accent',
              ].join(' ')}
            >
              <div className="font-medium">{item.name}</div>
              {item.actions.length > 0 && (
                <div className="mt-1 text-xs opacity-60">Actions: {item.actions.join(', ')}</div>
              )}
            </button>
          )
        })}
        {allEquipment.length === 0 && (
          <p className="text-sm opacity-60">No tech level 1 equipment found.</p>
        )}
      </div>
    </div>
  )
}
