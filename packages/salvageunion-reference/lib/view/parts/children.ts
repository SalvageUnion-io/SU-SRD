/**
 * An entity's CHILDREN — what it nests (grants, drones, a commander, a
 * pattern's loadout) — and its ACTIONS.
 */

import { extractVisibleActions, getChassisAbilities } from '../../actionResolution'
import { isAbility, isBaseAdvancedClass, isCoreClass } from '../../entityGuards'
import { resolveGrantedEntities } from '../../helpers'
import { SalvageUnionReference } from '../../index'
import { getPatterns, isBioTitanPattern } from '../../patterns'
import type {
  RefEntity,
  RefMetaAction,
  RefMetaEntity,
  RefObjectAnyPattern,
} from '../../schemas/index'
import { getEntitySlug } from '../../slug'
import type { EntityRef } from '../types'

/** A labelled group of nested entities. */
export type NestedGroup = { label: string; entities: RefEntity[] }

/** An ability's place in its tree: 1, 2, 3, then L (Legendary), then G. */
function levelOrder(level: number | 'L' | 'G'): number {
  return typeof level === 'number' ? level : level === 'L' ? 90 : 99
}

/**
 * A class's ability trees and where it advances, as its Discord card lists
 * them: a Core class's Core trees in its page's order, each tree's abilities
 * in level order, then ADVANCEMENT, the Hybrid Classes one of those trees
 * opens (`ability-tree-requirements`); a Hybrid Class's own tree. Advanced and
 * Legendary trees are not listed. A tree with no abilities is dropped; any
 * other entity has none.
 */
export function classTrees(entity: RefMetaEntity): NestedGroup[] {
  const core = isCoreClass(entity)
  if (!core && !isBaseAdvancedClass(entity)) return []
  const names: readonly string[] = core
    ? entity.coreTrees
    : entity.advancedTree
      ? [entity.advancedTree]
      : []
  const abilities = SalvageUnionReference.Abilities.all()
  const trees = names.flatMap((tree) => {
    const entities = abilities
      .filter((ability) => ability.tree === tree)
      .sort((a, b) => levelOrder(a.level) - levelOrder(b.level))
    return entities.length > 0 ? [{ label: tree, entities }] : []
  })
  if (!core || !entity.advanceable) return trees
  const requirements = new Map(
    SalvageUnionReference.AbilityTreeRequirements.all().map((r) => [r.name, r.requirement])
  )
  const hybrids = SalvageUnionReference.Classes.all().filter(
    (hybrid) =>
      isBaseAdvancedClass(hybrid) &&
      hybrid.advancedTree !== undefined &&
      (requirements.get(hybrid.advancedTree) ?? []).some((tree) => names.includes(tree))
  )
  return hybrids.length > 0 ? [...trees, { label: 'Advancement', entities: hybrids }] : trees
}

/**
 * Every entity a card nests, grouped: GRANTS (`resolveGrantedEntities`),
 * DRONES a chassis ability names, and a crawler's commander as NPCS —
 * synthesized into an npcs-schema record so it renders as one. De-duplicated
 * by `schemaName:id`. Patterns and actions are not here.
 */
export function nestedEntityGroups(entity: RefMetaEntity): NestedGroup[] {
  const groups = new Map<string, RefEntity[]>()
  const seen = new Set<string>()
  const push = (label: string, candidate: RefEntity | undefined): void => {
    if (!candidate) return
    const schema =
      'schemaName' in candidate && typeof candidate.schemaName === 'string'
        ? candidate.schemaName
        : ''
    const id = 'id' in candidate && typeof candidate.id === 'string' ? candidate.id : ''
    const name = 'name' in candidate && typeof candidate.name === 'string' ? candidate.name : ''
    const key = `${schema}:${id || name}`
    if (seen.has(key)) return
    seen.add(key)
    const bucket = groups.get(label)
    if (bucket) bucket.push(candidate)
    else groups.set(label, [candidate])
  }

  for (const granted of resolveGrantedEntities(entity as RefEntity)) push('Grants', granted)

  if ('chassisAbilities' in entity && Array.isArray(entity.chassisAbilities)) {
    for (const ability of entity.chassisAbilities) {
      if (typeof ability !== 'object' || ability === null || !('drone' in ability)) continue
      const { drone } = ability
      if (typeof drone === 'string') {
        push('Drones', SalvageUnionReference.getByNameIn('drones', drone))
      }
    }
  }

  if ('npc' in entity && entity.npc && typeof entity.npc === 'object') {
    const embedded = entity.npc
    const npcName =
      'name' in embedded && typeof embedded.name === 'string'
        ? embedded.name
        : 'position' in embedded && typeof embedded.position === 'string'
          ? embedded.position
          : undefined
    if (npcName) {
      // The embedded commander is not a full npcs record (no id/source/page);
      // it is rendered defensively by data shape, so no honest single cast exists.
      const synthesized = {
        ...embedded,
        name: npcName,
        schemaName: 'npcs',
      } as unknown as RefEntity
      push('NPCs', synthesized)
    }
  }

  return [...groups.entries()].map(([label, entities]) => ({ label, entities }))
}

/**
 * What a chassis's Discord card nests beyond its model's children: DRONES its
 * abilities name (the Little Sestra's Sestra Drone), once each, and its
 * PATTERNS, each a link to its own page and nothing more.
 */
export function chassisCardGroups(chassis: EntityRef): { label: string; items: EntityRef[] }[] {
  const record = SalvageUnionReference.get('chassis', chassis.id)
  if (!record) return []
  const drones: EntityRef[] = []
  for (const ability of getChassisAbilities(record) ?? []) {
    const name = 'drone' in ability ? ability.drone : undefined
    const drone =
      typeof name === 'string' ? SalvageUnionReference.getByNameIn('drones', name) : null
    if (!drone || drones.some((one) => one.id === drone.id)) continue
    const slug = getEntitySlug(drone as RefEntity)
    drones.push({ schemaName: 'drones', id: drone.id, slug, name: drone.name })
  }
  const patterns = (getPatterns(record) ?? []).map((pattern) => ({
    ...chassis,
    name: pattern.name,
    pattern: pattern.name,
  }))
  return [
    ...(drones.length > 0 ? [{ label: 'Drones', items: drones }] : []),
    ...(patterns.length > 0 ? [{ label: 'Patterns', items: patterns }] : []),
  ]
}

/**
 * A pattern's loadout, grouped: Systems, Modules, Drones. MULTIPLICITY IS
 * PRESERVED — one entry per installed copy, whether the data says `count` or
 * repeats the entry; an explicit `count: 0` installs nothing. A drone resolves
 * through `ref ?? name` (an instance name over a shared stat block). A
 * Bio-Titan pattern has no loadout, so it groups to nothing.
 */
export function patternGroups(pattern: RefObjectAnyPattern): NestedGroup[] {
  // A Bio-Titan pattern installs nothing: its difference is the actions it adds.
  if (isBioTitanPattern(pattern)) return []
  const groups = new Map<string, RefEntity[]>()
  const push = (label: string, candidate: RefEntity | undefined, count = 1): void => {
    if (!candidate) return
    const copies = Array.from({ length: count }, () => candidate)
    if (copies.length === 0) return
    const bucket = groups.get(label)
    if (bucket) bucket.push(...copies)
    else groups.set(label, copies)
  }
  for (const s of pattern.systems ?? [])
    push('Systems', SalvageUnionReference.getByNameIn('systems', s.name), s.count)
  for (const m of pattern.modules ?? [])
    push('Modules', SalvageUnionReference.getByNameIn('modules', m.name), m.count)
  for (const d of pattern.drones ?? [])
    push('Drones', SalvageUnionReference.getByNameIn('drones', d.ref ?? d.name))
  return [...groups.entries()].map(([label, entities]) => ({ label, entities }))
}

/** Systems and modules named by name arrays, resolved; unknown names dropped. */
export function resolveLoadout(
  systemNames: string[],
  moduleNames: string[]
): { systems: RefEntity[]; modules: RefEntity[] } {
  const systems = systemNames.flatMap((name) => {
    const found = SalvageUnionReference.getByNameIn('systems', name)
    return found ? [found] : []
  })
  const modules = moduleNames.flatMap((name) => {
    const found = SalvageUnionReference.getByNameIn('modules', name)
    return found ? [found] : []
  })
  return { systems, modules }
}

const stringsOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((n): n is string => typeof n === 'string') : []

/**
 * One item a vehicle lists, as the record it draws as: the systems entry of
 * that name (the Tank's 120mm Cannon), else the vehicle's own action of that
 * name (the Power Loader's "Rigging Arm (Vehicle)", the Tombstone Trackbox's
 * Shanty Home), which carries its own range, damage, traits and prose.
 */
function vehicleItem(name: string): RefEntity | undefined {
  const system = SalvageUnionReference.getByNameIn('systems', name)
  if (system) return system
  // An action is not in the `RefEntity` union, but it draws as a card all the
  // same, as a chassis ability or a Bio-Titan pattern's action does.
  return SalvageUnionReference.getByNameIn('actions', name) as RefEntity | undefined
}

/**
 * A vehicle's SYSTEMS: every item it lists, in the book's order and count (the
 * Power Loader's "Locomotion System / Rigging Arm x 2"). The book prints a
 * vehicle's equipment as one list, so each draws as a card the drone way,
 * whether the data names a systems entry or the vehicle's own action; a
 * vehicle has no ACTIONS slab. A name that resolves to neither is dropped.
 */
export function vehicleSystemNames(entity: RefMetaEntity): string[] {
  if (!('schemaName' in entity) || entity.schemaName !== 'vehicles') return []
  return stringsOf('actions' in entity ? entity.actions : undefined).filter(
    (name) => vehicleItem(name) !== undefined
  )
}

/**
 * A drone's or vehicle's OWN systems/modules loadout: a drone's from its name
 * arrays, a vehicle's from every item it lists (`vehicleSystemNames`).
 */
export function droneOwnLoadout(entity: RefMetaEntity): {
  systems: RefEntity[]
  modules: RefEntity[]
} {
  const systems = stringsOf('systems' in entity ? entity.systems : undefined)
  const modules = stringsOf('modules' in entity ? entity.modules : undefined)
  if (systems.length === 0) {
    const items = vehicleSystemNames(entity)
    if (items.length > 0) {
      return {
        systems: items.flatMap((name) => vehicleItem(name) ?? []),
        modules: resolveLoadout([], modules).modules,
      }
    }
  }
  return resolveLoadout(systems, modules)
}

/** The "Titanic Actions" meta-descriptor and its kin: always their own row. */
export function isTitanicAction(action: { name?: string }): boolean {
  return /titanic action/i.test(action.name ?? '')
}

/**
 * The SELF-action — named like its entity, by `name` or `displayName` — which
 * folds into the entity: its facets read as the entity's own, so only an
 * action that IS the entity folds. A lone action of another name does not.
 */
export function foldedActionOf<T extends { name?: string; displayName?: string }>(
  foldableActions: T[],
  entityName: string
): T | undefined {
  return foldableActions.find((a) => a.name === entityName || a.displayName === entityName)
}

/** An ability that grants entities: its actions belong to what it grants. */
function isGrantingAbility(entity: RefMetaEntity): boolean {
  return isAbility(entity) && resolveGrantedEntities(entity as RefEntity).length > 0
}

/**
 * An entity's actions, split: the folded self-action, and every other visible
 * one (titanic ones included). A granting ability has none of its own.
 */
export function entityActions(
  entity: RefMetaEntity,
  entityName: string
): { folded: RefMetaAction | undefined; others: RefMetaAction[] } {
  if ('actionSource' in entity || isGrantingAbility(entity))
    return { folded: undefined, others: [] }
  // A vehicle's systems are its children, not its actions.
  const systems = new Set(vehicleSystemNames(entity))
  const visible = (extractVisibleActions(entity) ?? []).filter((a) => !systems.has(a.name))
  const folded = foldedActionOf(
    visible.filter((a) => !isTitanicAction(a)),
    entityName
  )
  return { folded, others: visible.filter((a) => a !== folded) }
}
