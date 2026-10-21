import type { ReactNode } from 'react'
import type { EntityRef, RefAbility, RefClass, RefMetaEntity } from 'salvageunion-reference'
import { getEntitySlug, isAbility, SalvageUnionReference } from 'salvageunion-reference'
import type { Size } from '../../../styles/sizing'
import { Stat } from '../../atoms/Stat'
import { relation, Tag } from '../../entity'

/**
 * An ability's place in its tree (C11, R43): its
 * relation chip `TREE | Leadership`, which opens the class whose page draws
 * the tree; and, on its Page only, the abilities before and after it, in the
 * book's words ("You must have the preceding Ability in a Core Ability Tree
 * to train the next Ability", Workshop Manual p.23), as nested references
 * under the rest of the page, never chips. The first ability has no Preceding,
 * the last no Next; a tree of one level (Legendary, Generic) has neither.
 *
 * The Page band carries the tree, and every card head whose budget has
 * relations (C3: a compact or full Card, a Peek, where they only read,
 * ruleset §1.6). A Mini's are its Peek's.
 */
export type EntityRelation = {
  /** The relation, label first: 'Tree', 'Preceding', 'Next'. */
  label: string
  /** What the chip reads. */
  value: string
  /** The entity it opens and Peeks; absent, the chip only reads (no route). */
  ref?: EntityRef
}

/** A tree's level as a number, or none for a tree with no order (Legendary `L`, Generic `G`). */
const step = (level: RefAbility['level']): number | undefined =>
  typeof level === 'number' ? level : undefined

/** The class whose page draws the tree: its Core trees (bar the Salvager's), its Advanced or Legendary one. */
function treeOwner(tree: string): RefClass | undefined {
  if (!SalvageUnionReference.isLoaded('classes')) return undefined
  return SalvageUnionReference.Classes.all().find((c) => {
    if (c.advancedTree === tree || c.legendaryTree === tree) return true
    const core: readonly string[] = 'coreTrees' in c && c.advanceable ? c.coreTrees : []
    return core.includes(tree)
  })
}

/** An ability's tree relations, in the strip's order; none for anything else. */
export function abilityTreeRelations(entity: RefMetaEntity): EntityRelation[] {
  if (!isAbility(entity) || !entity.tree) return []
  const { tree } = entity
  const owner = treeOwner(tree)
  return [
    {
      label: 'Tree',
      value: tree,
      // The tree's chip opens its class, under the tree's name.
      ...(owner
        ? {
            ref: { schemaName: 'classes', id: owner.id, slug: getEntitySlug(owner), name: tree },
          }
        : {}),
    },
  ]
}

/** An ability's neighbours in its tree, Preceding then Next: none for anything else. */
export function abilityTreeNeighbours(
  entity: RefMetaEntity
): { label: 'Preceding' | 'Next'; abilities: RefAbility[] }[] {
  if (!isAbility(entity) || !entity.tree) return []
  const level = step(entity.level)
  if (level === undefined || !SalvageUnionReference.isLoaded('abilities')) return []
  const { tree } = entity
  const atLevel = (n: number) =>
    SalvageUnionReference.Abilities.all().filter((a) => a.tree === tree && step(a.level) === n)
  return (
    [
      { label: 'Preceding', abilities: atLevel(level - 1) },
      { label: 'Next', abilities: atLevel(level + 1) },
    ] as const
  ).filter((group) => group.abilities.length > 0)
}

/**
 * The relations as chips, one node each (so `Chips` counts each in its lane):
 * each that has an entity is its relation `Tag`, which opens and Peeks it.
 */
export function relationChips(
  relations: readonly EntityRelation[],
  size: Size = 'full'
): ReactNode[] {
  return relations.map(({ label, value, ref }) =>
    ref ? (
      <Tag
        key={`${label}-${value}`}
        tag={relation(`${label}-${value}`, label, value, { ref })}
        linkable
        size={size}
        wrap
      />
    ) : (
      <Stat key={`${label}-${value}`} label={label} value={value} size={size} wrap />
    )
  )
}

/** A card head's `Chips` nodes: its tree relations (C3: a Card's and a Peek's budget carries them). */
export function treeRelationNodes(entity: RefMetaEntity): { relation: ReactNode[] } | undefined {
  const relations = abilityTreeRelations(entity)
  return relations.length > 0 ? { relation: relationChips(relations, 'compact') } : undefined
}
