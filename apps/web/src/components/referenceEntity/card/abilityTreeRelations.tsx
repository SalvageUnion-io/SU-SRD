import type { ReactNode } from 'react'
import type { EntityRef, RefAbility, RefClass, RefMetaEntity } from 'salvageunion-reference'
import { getEntitySlug, isAbility, SalvageUnionReference } from 'salvageunion-reference'
import type { Size } from '../../../styles/sizing'
import { Stat } from '../../atoms/Stat'
import { EntityStat } from '../../entity'

/**
 * An ability's place in its tree, as relation chips (C11, owner's calls
 * 2026-10-19): `TREE | Leadership`, which opens the class whose page draws the
 * tree, then the ability before it and the ones after it, in the book's words
 * ("You must have the preceding Ability in a Core Ability Tree to train the
 * next Ability", Workshop Manual p.23): `PRECEDING | Folk Song`,
 * `NEXT | Valiant Speech`. The first ability has no PRECEDING, the last no
 * NEXT; a tree of one level (Legendary, Generic) has neither, and an absent
 * one leaves its lane empty (C6). The kind left the foot (E9), so the tree
 * rides the strip.
 *
 * The Page band carries them, and every card head whose budget has relations
 * (C3: a compact or full Card, a Peek, where they only read, ruleset §1.6). A
 * Token's are its Peek's.
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

const abilityRef = (a: RefAbility): EntityRef => ({
  schemaName: 'abilities',
  id: a.id,
  slug: getEntitySlug(a),
  name: a.name,
})

/** An ability's tree relations, in the strip's order; none for anything else. */
export function abilityTreeRelations(entity: RefMetaEntity): EntityRelation[] {
  if (!isAbility(entity) || !entity.tree) return []
  const { tree } = entity
  const owner = treeOwner(tree)
  const relations: EntityRelation[] = [
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
  const level = step(entity.level)
  if (level === undefined || !SalvageUnionReference.isLoaded('abilities')) return relations
  const atLevel = (n: number) =>
    SalvageUnionReference.Abilities.all().filter((a) => a.tree === tree && step(a.level) === n)
  for (const a of atLevel(level - 1))
    relations.push({ label: 'Preceding', value: a.name, ref: abilityRef(a) })
  for (const a of atLevel(level + 1))
    relations.push({ label: 'Next', value: a.name, ref: abilityRef(a) })
  return relations
}

/**
 * The relations as chips, one node each (so `Chips` counts each in its lane):
 * each that has an entity opens and Peeks it (`EntityStat`).
 */
export function relationChips(
  relations: readonly EntityRelation[],
  size: Size = 'full'
): ReactNode[] {
  return relations.map(({ label, value, ref }) =>
    ref ? (
      <EntityStat key={`${label}-${value}`} label={label} entityRef={ref} size={size} />
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
