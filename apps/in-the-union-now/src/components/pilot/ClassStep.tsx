import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefAbility, SURefClass, SURefEntity } from 'salvageunion-reference'
import { isCoreClass } from 'salvageunion-reference'
import { ReferenceEntityDisplay, SectionSeparator } from 'suref-react'
import { EntityChoiceCard } from '../shared/EntityChoiceCard'

type SURClassesAccessor = {
  all: () => unknown[]
}

type ClassStepProps = {
  selectedClassId: string
  onSelect: (classId: string) => void
  /** Injectable SUR for testing. */
  _sur?: SURClassesAccessor
}

function isBaseClass(cls: unknown): cls is SURefClass {
  return (
    typeof cls === 'object' &&
    cls !== null &&
    'coreTrees' in cls &&
    (cls as { coreTrees: unknown }).coreTrees !== null &&
    (cls as { coreTrees: unknown }).coreTrees !== undefined
  )
}

function levelSortKey(level: SURefAbility['level']): number {
  if (typeof level === 'number') return level
  if (level === 'L') return 90
  return 99
}

type TreeBucket = { tree: string; abilities: ReadonlyArray<SURefAbility> }

function bucketAbilitiesByTree(treeNames: ReadonlyArray<string>): TreeBucket[] {
  const all = SalvageUnionReference.Abilities.all() as ReadonlyArray<SURefAbility>
  const buckets: TreeBucket[] = []
  for (const tree of treeNames) {
    const abilities = all
      .filter((a) => a.tree === tree)
      .sort((a, b) => levelSortKey(a.level) - levelSortKey(b.level))
    if (abilities.length > 0) {
      buckets.push({ tree, abilities })
    }
  }
  return buckets
}

function collectTrees(cls: SURefClass): string[] {
  const trees: string[] = []
  if (isCoreClass(cls)) {
    trees.push(...cls.coreTrees)
    if (cls.advancedTree) trees.push(cls.advancedTree)
    if (cls.legendaryTree) trees.push(cls.legendaryTree)
  }
  return trees
}

/**
 * Inline "Show abilities" disclosure per class card. Each ability renders as
 * a compact (but non-listing) ReferenceEntityDisplay so the user can read
 * descriptions / traits / actions inline without leaving the wizard.
 */
function ClassAbilitiesDisclosure({ cls }: { cls: SURefClass }) {
  const buckets = bucketAbilitiesByTree(collectTrees(cls))
  if (buckets.length === 0) return null
  const total = buckets.reduce((sum, b) => sum + b.abilities.length, 0)

  return (
    <details className="group mt-2 rounded-md border border-border bg-background/40 px-3 py-2">
      <summary className="cursor-pointer select-none text-sm font-medium opacity-80 group-open:opacity-100">
        Show abilities ({total})
      </summary>
      <div className="mt-3 space-y-4">
        {buckets.map((bucket) => (
          <div key={bucket.tree} className="space-y-2">
            <SectionSeparator label={bucket.tree} value="Tree" compact />
            <div className="space-y-2">
              {bucket.abilities.map((ability) => (
                <ReferenceEntityDisplay
                  key={ability.id}
                  data={ability as unknown as SURefEntity}
                  compact
                  hide={{ choices: true }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </details>
  )
}

/**
 * Step 1: Choose a pilot class from available classes.
 * Only shows base classes (those with coreTrees defined). Each class card
 * exposes an in-place "Show abilities" disclosure so players can browse the
 * full ability set before committing.
 */
export function ClassStep({ selectedClassId, onSelect, _sur }: ClassStepProps) {
  const surClasses = _sur ?? SalvageUnionReference.Classes
  const allClasses = surClasses.all()
  const baseClasses = allClasses.filter(isBaseClass)

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4">
      <p className="text-sm opacity-70">
        Choose your pilot class. This determines your ability trees.
      </p>
      <div className="flex flex-col gap-4">
        {baseClasses.map((cls) => (
          <div key={cls.id} className="space-y-0">
            <EntityChoiceCard
              entity={cls}
              selected={cls.id === selectedClassId}
              onSelect={() => onSelect(cls.id)}
            />
            <ClassAbilitiesDisclosure cls={cls} />
          </div>
        ))}
      </div>
    </div>
  )
}
