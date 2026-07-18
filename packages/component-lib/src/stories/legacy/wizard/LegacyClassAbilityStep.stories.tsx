import type { Story } from '@ladle/react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefClass, SURefEntity } from 'salvageunion-reference'
import { isLegalCreationClass, legalCreationAbilities } from 'salvageunion-reference/rules'
import { TreeSep } from '../../../components/chrome/TreeSep'
import { ReferenceEntityDisplay } from '../../../components/referenceEntity/card/referenceEntityDisplayShim'
import { MasonryColumns } from '../../../components/shared/MasonryColumns'
import { Caption } from '../../_harness'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Pilot Class Ability Step' }

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

function levelOrder(l: number | 'L' | 'G'): number {
  return typeof l === 'number' ? l : l === 'L' ? 90 : 99
}

/** Mirror of ITUN classOptions.isBaseClass. */
function isBaseClass(cls: unknown): cls is SURefClass & { coreTrees: string[] } {
  return (
    typeof cls === 'object' &&
    cls !== null &&
    'coreTrees' in cls &&
    Array.isArray((cls as { coreTrees: unknown }).coreTrees) &&
    ((cls as { coreTrees: string[] }).coreTrees?.length ?? 0) > 0
  )
}

/** Mirror of ITUN classOptions.isSpecialisationClass. */
function isSpecialisationClass(cls: unknown): cls is SURefClass {
  return (
    typeof cls === 'object' &&
    cls !== null &&
    'advancedTree' in cls &&
    !isBaseClass(cls) &&
    'name' in cls
  )
}

/** Mirror of ITUN classOptions.selectableClasses. */
function selectableClasses(includeSpecialisations: boolean): {
  base: SURefClass[]
  specialisations: SURefClass[]
} {
  const all = SalvageUnionReference.Classes.all()
  return {
    base: all.filter(isBaseClass),
    specialisations: includeSpecialisations ? all.filter(isSpecialisationClass) : [],
  }
}

/** Mirror of ClassAbilityStep.editTreesFor (ClassAbilityStep.tsx lines 55-63). */
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
 * Verbatim reproduction of the presentational shell of
 * apps/in-the-union-now/src/components/pilot/ClassAbilityStep.tsx (render body
 * lines 76-185).
 *
 * Step 2 · Choose your Pilot and first Ability — master-detail in one pane:
 * pick 1 of the six CORE classes (SelCard entity cards, radio), which reveals
 * the Level-1 ability picker for that class's trees. Create mode shows only
 * LEGAL abilities (package `legalCreationAbilities`); edit mode lifts the
 * filters (specialisations + every level, TreeSep-grouped, uncapped toggle).
 */
function LegacyClassAbilityStep({ isEdit }: { isEdit: boolean }) {
  const [classId, setClassId] = useState('')
  const [selectedAbilities, setSelectedAbilities] = useState<string[]>([])

  const onSelectClass = (id: string) => {
    setClassId(id)
    setSelectedAbilities([])
  }
  const onSelectAbility = (abilityId: string) => {
    if (isEdit) {
      setSelectedAbilities((prev) =>
        prev.includes(abilityId) ? prev.filter((a) => a !== abilityId) : [...prev, abilityId]
      )
    } else {
      setSelectedAbilities([abilityId])
    }
  }

  const classes = selectableClasses(isEdit)
  const legalClasses = isEdit
    ? classes.base
    : classes.base.filter((c) => isLegalCreationClass((c as ClassLike).coreTrees))
  const selectedClass = [...classes.base, ...classes.specialisations].find(
    (c) => c.id === classId
  ) as ClassLike | undefined

  const allAbilities = SalvageUnionReference.Abilities.findAll(() => true) as AbilityLike[]

  const renderClassCard = (cls: SURefClass) => (
    <ReferenceEntityDisplay
      key={cls.id}
      data={cls}
      compact
      selected={cls.id === classId}
      selectionRole="toggle"
      cardClickLabel={cls.name}
      onCardClick={() => onSelectClass(cls.id)}
      hide={{ actions: true, choices: true }}
    />
  )

  const renderAbilityCard = (ability: AbilityLike) => (
    <ReferenceEntityDisplay
      key={ability.id}
      data={ability as unknown as SURefEntity}
      compact
      selected={selectedAbilities.includes(ability.id)}
      selectionRole="toggle"
      cardClickLabel={ability.name}
      label={ability.tree}
      onCardClick={() => onSelectAbility(ability.id)}
      hide={{ actions: true, choices: true }}
    />
  )

  const legalPool = legalCreationAbilities(allAbilities, selectedClass?.coreTrees).sort((a, b) =>
    a.tree.localeCompare(b.tree)
  )

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
        <p className="font-body text-sm text-ink">
          Pick a class to reveal its first-Ability choices.
        </p>
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
            <p className="font-body text-sm text-ink">No Level-1 abilities found for this class.</p>
          )}
        </>
      )}
    </div>
  )
}

export const Default: Story = () => (
  <div className="flex flex-col gap-4">
    <Caption>
      Legacy · Pilot Class+Ability step, create mode (ClassAbilityStep.tsx lines 76-185) — 6 core
      classes, then the legal Level-1 ability pool. Click a class to reveal its abilities.
    </Caption>
    <LegacyClassAbilityStep isEdit={false} />
  </div>
)

export const EditMode: Story = () => (
  <div className="flex flex-col gap-4">
    <Caption>
      Legacy · Class+Ability step, edit mode — specialisations appear; every level of every offered
      tree, TreeSep-grouped, uncapped toggle
    </Caption>
    <LegacyClassAbilityStep isEdit />
  </div>
)
