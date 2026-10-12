/**
 * What KIND of thing an entity is: its domain, its type stamp, have vs do, an
 * ability's tier numeral and a class's kind. Ported from component-lib's
 * `entityCardTone.ts`, which now reads these.
 */

import { isAbility } from '../../entityGuards.js'
import { getDisplayName, getHybridClasses } from '../../helpers.js'
import { SalvageUnionReference } from '../../index.js'
import type { SURefEnumSchemaName, SURefMetaEntity } from '../../schemas/index.js'
import type { ClassKind, EntityDomain } from '../types.js'

/**
 * SCHEMA → DOMAIN, exhaustive over the schema enum, so a new schema fails to
 * compile until it declares one: colour is an output of type. Book-derived
 * (Core Book 2.0a): pilot = orange, mech (chassis) = green, crawler = pink,
 * actor = rust, gear = tech-level ramp, glossary = ink.
 */
const SCHEMA_DOMAIN: Record<SURefEnumSchemaName, EntityDomain> = {
  abilities: 'pilot',
  'ability-tree-requirements': 'pilot',
  classes: 'pilot',
  chassis: 'mech',
  crawlers: 'crawler',
  'crawler-bays': 'crawler',
  'crawler-tech-levels': 'crawler',
  creatures: 'actor',
  'bio-titans': 'actor',
  npcs: 'actor',
  factions: 'actor',
  squads: 'actor',
  meld: 'actor',
  systems: 'gear',
  modules: 'gear',
  equipment: 'gear',
  drones: 'gear',
  vehicles: 'gear',
  distances: 'glossary',
  keywords: 'glossary',
  traits: 'glossary',
  guides: 'glossary',
  sources: 'glossary',
  'roll-tables': 'glossary',
  'tech-levels': 'glossary',
}

/** The domain a schema belongs to; `undefined` outside the enum (`actions` too). */
export function schemaDomain(schemaName: string): EntityDomain | undefined {
  const bySchema: Partial<Record<string, EntityDomain>> = SCHEMA_DOMAIN
  return bySchema[schemaName]
}

/**
 * HAVE vs DO (ruleset §5). Things you DO — an ability, an action — are the
 * book's ink banner; everything you HAVE wears its own tone. A data-shape
 * check: an ability carries `tree` + `level`, an action its `actionSource`.
 */
export function isDoEntity(entity: SURefMetaEntity): boolean {
  if (entity == null || typeof entity !== 'object') return false
  return isAbility(entity) || 'actionSource' in entity
}

/** An ability's tier numeral: its numeric level in the tree (not G or L). */
export function tierNumeral(entity: SURefMetaEntity): string | undefined {
  if (!isAbility(entity)) return undefined
  const level = entity.level
  return level != null && Number.isFinite(Number(level)) ? String(level) : undefined
}

/** The bare type: "Action", "Crawler Type", else the schema's display name. */
export function entityTypeLabel(schemaName: SURefEnumSchemaName | 'actions'): string {
  if (schemaName === 'actions') return 'Action'
  if (schemaName === 'crawlers') return 'Crawler Type'
  return getDisplayName(schemaName)
}

/** The seam's type stamp: the type, and for an ability its tree too
 * ("Ability · Forging Tree"). */
export function entityStamp(
  schemaName: SURefEnumSchemaName | 'actions',
  entity: SURefMetaEntity
): string {
  const type = entityTypeLabel(schemaName)
  if (isAbility(entity) && entity.tree != null && String(entity.tree).length > 0) {
    return `${type} · ${String(entity.tree)} Tree`
  }
  return type
}

/** A pilot CLASS, by data shape: `coreTrees` and `hybrid` are class-only keys. */
export function isClassEntity(entity: SURefMetaEntity): boolean {
  if (entity == null || typeof entity !== 'object') return false
  return 'coreTrees' in entity || 'hybrid' in entity
}

/**
 * Which kind of class. ORDER and `=== false` are load-bearing: `advanceable`
 * is undefined on every hybrid, so a falsiness test would stamp all five
 * hybrids NON-ADVANCEABLE.
 */
export function classKind(entity: SURefMetaEntity): ClassKind | undefined {
  if (!isClassEntity(entity)) return undefined
  if ('hybrid' in entity && entity.hybrid === true) return 'HYBRID'
  if ('advanceable' in entity && entity.advanceable === false) return 'NON-ADVANCEABLE'
  return 'BASE'
}

/** The trees a HYBRID class advances from, read by the class's own name. */
export function classRequirements(entity: SURefMetaEntity): string[] {
  if (classKind(entity) !== 'HYBRID') return []
  const name = 'name' in entity && entity.name != null ? String(entity.name) : ''
  if (!name) return []
  const requirement = SalvageUnionReference.getByNameIn(
    'ability-tree-requirements',
    name
  )?.requirement
  return Array.isArray(requirement) ? requirement.map(String) : []
}

/** Tree names that belong to hybrid classes, cached per loaded classes array. */
const hybridTrees = new WeakMap<readonly unknown[], Set<string>>()

export function isHybridTree(tree: string): boolean {
  const classes = SalvageUnionReference.Classes.all()
  let trees = hybridTrees.get(classes)
  if (!trees) {
    trees = new Set()
    for (const cls of getHybridClasses()) {
      if ('advancedTree' in cls && cls.advancedTree) trees.add(String(cls.advancedTree))
    }
    hybridTrees.set(classes, trees)
  }
  return trees.has(tree)
}
