import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefClass } from 'salvageunion-reference'
import { STARTING_ABILITY_BUDGET } from '../../lib/constants'
import { EntityChoiceCard } from '../shared/EntityChoiceCard'

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
 */
export function AbilitiesStep({ classId, selectedAbilities, onToggle, _sur }: AbilitiesStepProps) {
  const surClasses = _sur?.Classes ?? SalvageUnionReference.Classes
  const surAbilities = _sur?.Abilities ?? SalvageUnionReference.Abilities
  const cls = surClasses.find((c: unknown) => (c as SURefClass).id === classId)

  if (!cls) {
    return <p className="text-sm text-destructive">Class not found. Go back and select a class.</p>
  }

  const coreTrees = isBaseClass(cls) ? cls.coreTrees : []

  // Use maxAbilities from reference data when it is smaller than the starting budget
  // (e.g. a class with fewer total abilities than the global cap). When the class
  // exposes a higher value (e.g. 10 for total advancement), the starting budget wins.
  const budget =
    isBaseClass(cls) && cls.maxAbilities
      ? Math.min(cls.maxAbilities, STARTING_ABILITY_BUDGET)
      : STARTING_ABILITY_BUDGET

  const availableAbilities = surAbilities.findAll((a: unknown) => {
    const ab = a as AbilityLike
    return coreTrees.includes(ab.tree) && ab.level === 1
  }) as AbilityLike[]

  const isAtBudget = selectedAbilities.length >= budget

  return (
    <div className="w-full space-y-4">
      <p className="text-sm opacity-70">
        Choose up to {budget} starting abilities from your class trees.{' '}
        <span className="font-medium">
          {selectedAbilities.length}/{budget} selected
        </span>
      </p>
      {/*
        SRD catalog pattern — each ability is its own compact
        ReferenceEntityDisplay card with the tree name rendered as the
        card's pseudo-header label (matches the SchemaViewerIsland
        rendering in suref-web). No external <h3> tree groupings — the
        tree label lives ON the card frame itself.

        Order: keep the original coreTrees declaration order so abilities
        from the same tree stay contiguous in the list.
      */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {coreTrees.flatMap((tree) =>
          availableAbilities
            .filter((a) => a.tree === tree)
            .map((ability) => {
              const isSelected = selectedAbilities.includes(ability.id)
              const isDisabled = !isSelected && isAtBudget
              return (
                <EntityChoiceCard
                  key={ability.id}
                  entity={ability}
                  selected={isSelected}
                  disabled={isDisabled}
                  disabledReason={
                    isDisabled
                      ? `Budget reached (${selectedAbilities.length}/${budget} selected)`
                      : undefined
                  }
                  label={ability.tree}
                  onSelect={() => onToggle(ability.id)}
                />
              )
            })
        )}
      </div>
      {availableAbilities.length === 0 && (
        <p className="text-sm opacity-60">No level-1 abilities found for this class.</p>
      )}
    </div>
  )
}
