import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefClass } from 'salvageunion-reference'

type SURAbilitiesAccessor = {
  findAll: (fn: (x: unknown) => boolean) => unknown[]
}
type SURClassesAccessor = {
  find: (fn: (x: unknown) => boolean) => unknown
}

type AbilitiesStepProps = {
  classId: string
  selectedAbilities: string[]
  onToggle: (abilityId: string) => void
  /** Injectable SUR for testing. */
  _sur?: { Classes: SURClassesAccessor; Abilities: SURAbilitiesAccessor }
}

type AbilityLike = {
  id: string
  name: string
  tree: string
  level: number
  description?: string
}

function isBaseClass(
  cls: unknown
): cls is SURefClass & { coreTrees: string[]; maxAbilities: number } {
  return (
    typeof cls === 'object' &&
    cls !== null &&
    'coreTrees' in cls &&
    (cls as Record<string, unknown>).coreTrees !== null &&
    (cls as Record<string, unknown>).coreTrees !== undefined
  )
}

/**
 * Step 2: Choose starting abilities for the selected class.
 * Shows level-1 abilities from the class's core trees.
 * Players start with a limited set; the class's maxAbilities defines the cap.
 */
export function AbilitiesStep({ classId, selectedAbilities, onToggle, _sur }: AbilitiesStepProps) {
  const surClasses = _sur?.Classes ?? SalvageUnionReference.Classes
  const surAbilities = _sur?.Abilities ?? SalvageUnionReference.Abilities
  const cls = surClasses.find((c: unknown) => (c as SURefClass).id === classId)

  if (!cls) {
    return <p className="text-sm text-destructive">Class not found. Go back and select a class.</p>
  }

  const coreTrees = isBaseClass(cls) ? cls.coreTrees : []

  // Starting ability budget: 3 at character creation (per Salvage Union core rules)
  const startingAbilityBudget = 3

  const availableAbilities = surAbilities.findAll((a: unknown) => {
    const ab = a as AbilityLike
    return coreTrees.includes(ab.tree) && ab.level === 1
  }) as AbilityLike[]

  const isAtBudget = selectedAbilities.length >= startingAbilityBudget

  return (
    <div className="space-y-4">
      <p className="text-sm opacity-70">
        Choose up to {startingAbilityBudget} starting abilities from your class trees.{' '}
        <span className="font-medium">
          {selectedAbilities.length}/{startingAbilityBudget} selected
        </span>
      </p>
      {coreTrees.map((tree) => {
        const treeAbilities = availableAbilities.filter((a) => a.tree === tree)
        if (treeAbilities.length === 0) return null

        return (
          <div key={tree} className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide opacity-70">{tree}</h3>
            <div className="grid gap-2">
              {treeAbilities.map((ability) => {
                const isSelected = selectedAbilities.includes(ability.id)
                const isDisabled = !isSelected && isAtBudget

                return (
                  <button
                    key={ability.id}
                    type="button"
                    onClick={() => !isDisabled && onToggle(ability.id)}
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
                    <div className="font-medium">{ability.name}</div>
                    {ability.description && (
                      <div className="mt-1 text-xs opacity-60">{ability.description}</div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
      {availableAbilities.length === 0 && (
        <p className="text-sm opacity-60">No level-1 abilities found for this class.</p>
      )}
    </div>
  )
}
