import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefClass } from 'salvageunion-reference'
import { TreeSep } from 'suref-react'
import { SelCard } from '../wizard/SelCard'
import { SelMasonry } from '../wizard/SelMasonry'

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
  /**
   * Selection cap. When set (create mode) further picks beyond the budget
   * are disabled. Omit for uncapped selection (edit mode — advancement
   * beyond the creation budget is allowed; rule caps are soft warnings).
   */
  budget?: number
  /**
   * When true, every level of every class tree (core + advanced + legendary)
   * is offered, grouped under TreeSep headers (edit mode). When false, only
   * level-1 core-tree abilities render in a flat grid (creation).
   */
  allLevels?: boolean
  /** Injectable SUR for testing. */
  _sur?: { Classes: SURClassesAccessor; Abilities: SURAbilitiesAccessor }
}

type AbilityLike = {
  id: string
  name: string
  tree: string
  level: number | 'L' | 'G'
  description?: string
}

type ClassLike = {
  coreTrees?: string[]
  advancedTree?: string
  legendaryTree?: string
}

function levelOrder(l: number | 'L' | 'G'): number {
  return typeof l === 'number' ? l : l === 'L' ? 90 : 99
}

/**
 * Trees offered for the given class. Edit mode appends the advanced and
 * legendary trees, plus the trees of already-selected abilities — so a pilot
 * who switched to a Hybrid specialisation keeps their learned core trees
 * visible and toggleable.
 */
function treesFor(cls: ClassLike, allLevels: boolean, selectedTrees: string[]): string[] {
  const trees: string[] = [...(cls.coreTrees ?? [])]
  if (allLevels) {
    if (cls.advancedTree) trees.push(cls.advancedTree)
    if (cls.legendaryTree) trees.push(cls.legendaryTree)
    for (const tree of selectedTrees) {
      if (!trees.includes(tree)) trees.push(tree)
    }
  }
  return trees
}

/**
 * Abilities step — 3-col Sel-grid variant (design §3.2). Creation offers the
 * level-1 core-tree picks capped at the starting budget; edit mode offers the
 * full trees uncapped (prerequisites are pre-save soft warnings, plan 3.3).
 */
export function AbilitiesStep({
  classId,
  selectedAbilities,
  onToggle,
  budget,
  allLevels = false,
  _sur,
}: AbilitiesStepProps) {
  const surClasses = _sur?.Classes ?? SalvageUnionReference.Classes
  const surAbilities = _sur?.Abilities ?? SalvageUnionReference.Abilities
  const cls = surClasses.find((c: unknown) => (c as SURefClass).id === classId) as
    | ClassLike
    | undefined

  if (!cls) {
    return <p className="text-sm text-rust">Class not found. Go back and select a class.</p>
  }

  const allAbilities = surAbilities.findAll(() => true) as AbilityLike[]
  const selectedTrees = allAbilities
    .filter((a) => selectedAbilities.includes(a.id))
    .map((a) => a.tree)
  const trees = treesFor(cls, allLevels, selectedTrees)

  const isAtBudget = budget !== undefined && selectedAbilities.length >= budget

  const abilitiesIn = (tree: string): AbilityLike[] =>
    allAbilities
      .filter((a) => a.tree === tree && (allLevels || a.level === 1))
      .sort((a, b) => levelOrder(a.level) - levelOrder(b.level))

  const renderCard = (ability: AbilityLike) => {
    const isSelected = selectedAbilities.includes(ability.id)
    // At-budget cards grey out; the "Max Abilities" notice lives once in the
    // WizShell footer beside the buttons, not under every blocked card.
    const isDisabled = !isSelected && isAtBudget
    return (
      <SelCard
        key={ability.id}
        entity={ability}
        name={ability.name}
        selected={isSelected}
        disabled={isDisabled}
        label={ability.tree}
        onToggle={() => onToggle(ability.id)}
      />
    )
  }

  const anyAbilities = trees.some((tree) => abilitiesIn(tree).length > 0)

  return (
    <div className="w-full space-y-5">
      {allLevels ? (
        // Edit mode — TreeSep-grouped grids per tree, every level offered.
        trees.map((tree) => {
          const treeAbilities = abilitiesIn(tree)
          if (treeAbilities.length === 0) return null
          return (
            <section key={tree} className="space-y-3">
              <TreeSep name={tree} />
              <SelMasonry>{treeAbilities.map(renderCard)}</SelMasonry>
            </section>
          )
        })
      ) : (
        // Create mode — flat masonry, tree label on the card frame.
        <SelMasonry>{trees.flatMap((tree) => abilitiesIn(tree).map(renderCard))}</SelMasonry>
      )}
      {!anyAbilities && <p className="text-sm text-wk-muted">No abilities found for this class.</p>}
    </div>
  )
}
