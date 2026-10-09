import { EmptyState, MasonryColumns, ReferenceEntityCard, Slab } from 'component-lib'
import type { SURefAbility, SURefClass } from 'salvageunion-reference'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import { isLegalCreationClass, legalCreationAbilities } from 'salvageunion-reference/rules'
import { selectableClasses } from './classOptions'

type SURClassesAccessor = {
  all: () => unknown[]
  find: (fn: (x: unknown) => boolean) => unknown
}
type SURAbilitiesAccessor = {
  findAll: (fn: (x: unknown) => boolean) => unknown[]
}

type ClassAbilityStepProps = {
  classId: string
  selectedAbilities: string[]
  /** Radio semantics — a new class replaces the old. */
  onSelectClass: (classId: string) => void
  /** Radio semantics — the pick REPLACES the current ability. Emits its slug. */
  onSelectAbility: (slug: string) => void
  /** Injectable SUR for testing. */
  _sur?: { Classes: SURClassesAccessor; Abilities: SURAbilitiesAccessor }
}

/**
 * Step 2 · Choose your Pilot and your first Ability (Pilot Bay p.18, merged
 * per plan §4.1) — master-detail in one pane, mockup Screen 01: pick 1 of the
 * six CORE classes (SelCard entity cards, radio semantics), which reveals the
 * Level-1 ability picker for that class's trees. Only LEGAL abilities render
 * (package `legalCreationAbilities`: level 1 ∧ tree ∈ coreTrees — the
 * Salvager sees all 15 core-tree Level-1s); the pick is a radio, exactly 1.
 */
export function ClassAbilityStep({
  classId,
  selectedAbilities,
  onSelectClass,
  onSelectAbility,
  _sur,
}: ClassAbilityStepProps) {
  const surClasses: SURClassesAccessor = _sur?.Classes ?? SalvageUnionReference.Classes
  const surAbilities: SURAbilitiesAccessor = _sur?.Abilities ?? SalvageUnionReference.Abilities

  const { base } = selectableClasses(surClasses, false)
  const legalClasses = base.filter((c) => isLegalCreationClass(c.coreTrees))
  const selectedClass = base.find((c) => c.id === classId)

  // The injectable accessor is `unknown`-typed for test seams (itun's
  // PilotWizard passes the same shape), so the ONE cast lives here at the
  // seam: the production accessor really returns `SURefAbility[]`, and a
  // properly-typed ability then flows into the card with no further forcing.
  const allAbilities = surAbilities.findAll(() => true) as SURefAbility[]

  const renderClassCard = (cls: SURefClass) => (
    <ReferenceEntityCard
      key={cls.id}
      data={cls}
      size="medium"
      selected={cls.id === classId}
      selectionRole="toggle"
      cardClickLabel={cls.name}
      onCardClick={() => onSelectClass(cls.id)}
      hide={{ actions: true, choices: true }}
    />
  )

  const renderAbilityCard = (ability: SURefAbility) => (
    <ReferenceEntityCard
      key={ability.id}
      data={ability}
      size="medium"
      selected={selectedAbilities.includes(getEntitySlug(ability))}
      selectionRole="toggle"
      cardClickLabel={ability.name}
      onCardClick={() => onSelectAbility(getEntitySlug(ability))}
      hide={{ actions: true, choices: true }}
    />
  )

  // The class's legal Level-1 pool, flat. The card names its own tree in the
  // seam pill (`[Forging | 1]`), so the pool needs no extra label.
  const legalPool = legalCreationAbilities(allAbilities, selectedClass?.coreTrees).sort((a, b) =>
    a.tree.localeCompare(b.tree)
  )

  return (
    <div className="w-full space-y-5">
      <Slab variant="solid" label="Pilot Class" count="Choose 1" />
      <MasonryColumns maxColumns={2}>{legalClasses.map(renderClassCard)}</MasonryColumns>

      {selectedClass === undefined ? (
        <EmptyState
          headline="No Class Selected"
          body="Pick a class to reveal its first-Ability choices."
        />
      ) : (
        <>
          <Slab
            variant="solid"
            label={`First Ability · ${selectedClass.name} Trees · Level 1`}
            count="Choose 1"
          />
          <MasonryColumns maxColumns={2}>{legalPool.map(renderAbilityCard)}</MasonryColumns>
          {legalPool.length === 0 && (
            <EmptyState headline="No Abilities" body="No Level-1 abilities found for this class." />
          )}
        </>
      )}
    </div>
  )
}
