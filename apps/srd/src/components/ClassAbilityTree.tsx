import { Entity, Slab } from 'component-lib'
import { useMemo } from 'react'
import type { SURefAbility, SURefClass } from 'salvageunion-reference'
import {
  getEntitySlug,
  isBaseAdvancedClass,
  isCoreClass,
  SalvageUnionReference,
} from 'salvageunion-reference'
import { itemHref } from '../lib/entityHref'

type TreeGroup = { tree: string; abilities: SURefAbility[] }

type ResolvedTrees = {
  coreTrees: TreeGroup[]
  advancedTree: TreeGroup | null
  legendaryTree: TreeGroup | null
}

type ClassAbilityTreeProps = {
  classEntity: SURefClass
}

function levelOrder(l: number | 'L' | 'G'): number {
  return typeof l === 'number' ? l : l === 'L' ? 90 : 99
}

function resolveClassTrees(classEntity: SURefClass): ResolvedTrees {
  const allAbilities = SalvageUnionReference.Abilities.all()

  const resolveTree = (treeName: string): TreeGroup | null => {
    const matching = allAbilities
      .filter((a) => a.tree === treeName)
      .sort((a, b) => levelOrder(a.level) - levelOrder(b.level))
    return matching.length > 0 ? { tree: treeName, abilities: matching } : null
  }

  if (isCoreClass(classEntity)) {
    return {
      coreTrees: classEntity.coreTrees.map(resolveTree).filter((g): g is TreeGroup => g !== null),
      advancedTree: classEntity.advancedTree ? resolveTree(classEntity.advancedTree) : null,
      legendaryTree: classEntity.legendaryTree ? resolveTree(classEntity.legendaryTree) : null,
    }
  }

  if (isBaseAdvancedClass(classEntity)) {
    return {
      coreTrees: [],
      advancedTree: resolveTree(classEntity.advancedTree),
      legendaryTree: resolveTree(classEntity.legendaryTree),
    }
  }

  return { coreTrees: [], advancedTree: null, legendaryTree: null }
}

/** The tree's slab names the kind, so its Rows drop the seam stamp. */
const OMIT_KIND = ['kind'] as const

/**
 * One ability in its tree: a Row in link mode, a real same-tab link to the
 * ability's page — the listing row's shape (`EntityListingRow`), so a crawler
 * follows it and a reader keeps their back button.
 */
function AbilityTreeListing({ ability }: { ability: SURefAbility }) {
  return (
    <Entity
      form="row"
      entity={ability}
      mode={{ kind: 'link', href: itemHref('abilities', getEntitySlug(ability)) }}
      omit={OMIT_KIND}
    />
  )
}

/**
 * Which track a tree draws (ruleset "Where the screen departs from print": the
 * ability-tree track stays a diagram). Core and Advanced/Hybrid trees are
 * trained in order — each Ability needs the one before it — so their three
 * tiers hang off one connected pipe in the tier's hue (Core = brick, Advanced
 * = pilot). A Legendary tree is a pick-one, not a sequence, so it has none.
 */
type TreeTrack = 'core' | 'advanced' | null

function TreeSection({ tree, abilities, track }: TreeGroup & { track: TreeTrack }) {
  return (
    <section className="srd-ability-tree__group">
      <Slab variant="solid" label={tree} count="Tree" />
      <ol className="srd-ability-tree__track" data-track={track ?? undefined}>
        {abilities.map((ability) => (
          <li key={ability.id} className="srd-ability-tree__tier">
            <AbilityTreeListing ability={ability} />
          </li>
        ))}
      </ol>
    </section>
  )
}

export function ClassAbilityTree({ classEntity }: ClassAbilityTreeProps) {
  const trees = useMemo(() => resolveClassTrees(classEntity), [classEntity])

  const hasCoreTrees = trees.coreTrees.length > 0
  const hasSpecialTrees = !!trees.advancedTree || !!trees.legendaryTree
  if (!hasCoreTrees && !hasSpecialTrees) return null

  return (
    <div className="srd-ability-tree">
      {/* The trees are a full-width section of their own beneath the class
          artwork + flavour, so they get a section Slab like any other group. */}
      <Slab variant="dashed" label="Abilities" />
      {hasCoreTrees && (
        <div className="srd-ability-tree__row" data-columns="3">
          {trees.coreTrees.map((group) => (
            <TreeSection key={group.tree} {...group} track="core" />
          ))}
        </div>
      )}
      {hasSpecialTrees && (
        <div className="srd-ability-tree__row" data-columns="2">
          {trees.advancedTree && <TreeSection {...trees.advancedTree} track="advanced" />}
          {trees.legendaryTree && <TreeSection {...trees.legendaryTree} track={null} />}
        </div>
      )}
    </div>
  )
}
