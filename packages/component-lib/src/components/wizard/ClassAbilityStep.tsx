import { SalvageUnionReference } from 'salvageunion-reference'
import { EmptyState } from '../chrome/EmptyState'
import type { SURefClass, SURefEntity } from 'salvageunion-reference'
import { isLegalCreationClass, legalCreationAbilities } from 'salvageunion-reference/rules'
import { TreeSep } from '../chrome/TreeSep'
import { MasonryColumns } from '../shared/MasonryColumns'
import { ReferenceEntityCard } from '../referenceEntity/card/ReferenceEntityCard'
import { selectableClasses } from './classOptions'

type SURClassesAccessor = {
  all: () => unknown[]
  find: (fn: (x: unknown) => boolean) => unknown
}
type SURAbilitiesAccessor = {
  findAll: (fn: (x: unknown) => boolean) => unknown[]
}

type AbilityLike = {
  id: string
  name: string
  tree: string
  level: number | 'L' | 'G'
}

type ClassLike = {
  id: string
  name: string
  coreTrees?: string[]
  advancedTree?: string
  legendaryTree?: string
}

type ClassAbilityStepProps = {
  /** Edit mode lifts every creation filter and keeps multi-select abilities. */
  isEdit: boolean
  classId: string
  selectedAbilities: string[]
  /** Radio semantics — a new class replaces the old. */
  onSelectClass: (classId: string) => void
  /**
   * Create mode: radio — the pick REPLACES the current ability.
   * Edit mode: toggle — uncapped multi-select (advancement, soft warnings).
   */
  onSelectAbility: (abilityId: string) => void
  /** Injectable SUR for testing. */
  _sur?: { Classes: SURClassesAccessor; Abilities: SURAbilitiesAccessor }
}

function levelOrder(l: number | 'L' | 'G'): number {
  return typeof l === 'number' ? l : l === 'L' ? 90 : 99
}

/**
 * Trees offered in EDIT mode: core + advanced + legendary trees, plus the
 * trees of already-selected abilities — a pilot who switched to a Hybrid
 * specialisation keeps their learned core trees visible and toggleable.
 */
function editTreesFor(cls: ClassLike, selectedTrees: string[]): string[] {
  const trees: string[] = [...(cls.coreTrees ?? [])]
  if (cls.advancedTree) trees.push(cls.advancedTree)
  if (cls.legendaryTree) trees.push(cls.legendaryTree)
  for (const tree of selectedTrees) {
    if (!trees.includes(tree)) trees.push(tree)
  }
  return trees
}

/**
 * Step 2 · Choose your Pilot and your first Ability (Pilot Bay p.18, merged
 * per plan §4.1) — master-detail in one pane, mockup Screen 01: pick 1 of the
 * six CORE classes (SelCard entity cards, radio semantics), which reveals the
 * Level-1 ability picker for that class's trees. Only LEGAL abilities render
 * (package `legalCreationAbilities`: level 1 ∧ tree ∈ coreTrees — the
 * Salvager sees all 15 core-tree Level-1s); the pick is a radio, exactly 1.
 *
 * Edit mode lifts the filters (specialisation classes appear; every level of
 * every class tree, TreeSep-grouped, uncapped toggle) — the soft regime.
 */
export function ClassAbilityStep({
  isEdit,
  classId,
  selectedAbilities,
  onSelectClass,
  onSelectAbility,
  _sur,
}: ClassAbilityStepProps) {
  const surClasses = _sur?.Classes ?? (SalvageUnionReference.Classes as SURClassesAccessor)
  const surAbilities = _sur?.Abilities ?? (SalvageUnionReference.Abilities as SURAbilitiesAccessor)

  const classes = selectableClasses(surClasses, isEdit)
  const legalClasses = isEdit
    ? classes.base
    : classes.base.filter((c) => isLegalCreationClass((c as ClassLike).coreTrees))
  const selectedClass = [...classes.base, ...classes.specialisations].find(
    (c) => c.id === classId
  ) as ClassLike | undefined

  const allAbilities = surAbilities.findAll(() => true) as AbilityLike[]

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

  const renderAbilityCard = (ability: AbilityLike) => (
    <ReferenceEntityCard
      key={ability.id}
      data={ability as unknown as SURefEntity}
      size="medium"
      selected={selectedAbilities.includes(ability.id)}
      selectionRole="toggle"
      cardClickLabel={ability.name}
      label={ability.tree}
      onCardClick={() => onSelectAbility(ability.id)}
      hide={{ actions: true, choices: true }}
    />
  )

  // Create mode: the class's legal Level-1 pool, flat, tree label on the card.
  const legalPool = legalCreationAbilities(allAbilities, selectedClass?.coreTrees).sort((a, b) =>
    a.tree.localeCompare(b.tree)
  )

  // Edit mode: every level of every offered tree, TreeSep-grouped.
  const selectedTrees = allAbilities
    .filter((a) => selectedAbilities.includes(a.id))
    .map((a) => a.tree)
  const editTrees = selectedClass ? editTreesFor(selectedClass, selectedTrees) : []
  const editAbilitiesIn = (tree: string): AbilityLike[] =>
    allAbilities
      .filter((a) => a.tree === tree)
      .sort((a, b) => levelOrder(a.level) - levelOrder(b.level))

  return (
    <div className="w-full space-y-5">
      <TreeSep name="Pilot Class" suffix="Choose 1" />
      <MasonryColumns maxColumns={2}>{legalClasses.map(renderClassCard)}</MasonryColumns>
      {isEdit && classes.specialisations.length > 0 && (
        <>
          <TreeSep name="Advanced / Hybrid" suffix="Requires 6 core abilities" />
          <MasonryColumns maxColumns={2}>
            {classes.specialisations.map(renderClassCard)}
          </MasonryColumns>
        </>
      )}

      {selectedClass === undefined ? (
        <EmptyState
          headline="No Class Selected"
          body="Pick a class to reveal its first-Ability choices."
        />
      ) : isEdit ? (
        <>
          <TreeSep name="Abilities" suffix="Any level" />
          {editTrees.map((tree) => {
            const treeAbilities = editAbilitiesIn(tree)
            if (treeAbilities.length === 0) return null
            return (
              <section key={tree} className="space-y-3">
                <TreeSep name={tree} />
                <MasonryColumns maxColumns={2}>
                  {treeAbilities.map(renderAbilityCard)}
                </MasonryColumns>
              </section>
            )
          })}
        </>
      ) : (
        <>
          <TreeSep
            name={`First Ability · ${selectedClass.name} Trees · Level 1`}
            suffix="Choose 1"
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
