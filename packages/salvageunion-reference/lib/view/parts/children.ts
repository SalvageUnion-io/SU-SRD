/**
 * An entity's CHILDREN — what it nests (grants, drones, a commander, a
 * pattern's loadout) — and its ACTIONS. Ported from component-lib's
 * `resolveNestedEntities.ts`, `resolveFoldedAction.ts` and `nestedSections.ts`.
 */

import { extractVisibleActions } from '../../actionResolution'
import { isAbility } from '../../entityGuards'
import { resolveGrantedEntities } from '../../helpers'
import { SalvageUnionReference } from '../../index'
import { isBioTitanPattern } from '../../patterns'
import type {
  SURefEntity,
  SURefMetaAction,
  SURefMetaEntity,
  SURefObjectAnyPattern,
} from '../../schemas/index'

/** A labelled group of nested entities. */
export type NestedGroup = { label: string; entities: SURefEntity[] }

/**
 * Every entity a card nests, grouped: GRANTS (`resolveGrantedEntities`),
 * DRONES a chassis ability names, and a crawler's commander as NPCS —
 * synthesized into an npcs-schema record so it renders as one. De-duplicated
 * by `schemaName:id`. Patterns and actions are not here.
 */
export function nestedEntityGroups(entity: SURefMetaEntity): NestedGroup[] {
  const groups = new Map<string, SURefEntity[]>()
  const seen = new Set<string>()
  const push = (label: string, candidate: SURefEntity | undefined): void => {
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

  for (const granted of resolveGrantedEntities(entity as SURefEntity)) push('Grants', granted)

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
      } as unknown as SURefEntity
      push('NPCs', synthesized)
    }
  }

  return [...groups.entries()].map(([label, entities]) => ({ label, entities }))
}

/**
 * A pattern's loadout, grouped: Systems, Modules, Drones. MULTIPLICITY IS
 * PRESERVED — one entry per installed copy, whether the data says `count` or
 * repeats the entry; an explicit `count: 0` installs nothing. A drone resolves
 * through `ref ?? name` (an instance name over a shared stat block). A
 * Bio-Titan pattern has no loadout, so it groups to nothing.
 */
export function patternGroups(pattern: SURefObjectAnyPattern): NestedGroup[] {
  // A Bio-Titan pattern installs nothing: its difference is the actions it adds.
  if (isBioTitanPattern(pattern)) return []
  const groups = new Map<string, SURefEntity[]>()
  const push = (label: string, candidate: SURefEntity | undefined, count = 1): void => {
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
): { systems: SURefEntity[]; modules: SURefEntity[] } {
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

/** A drone's OWN systems/modules loadout, from its name arrays. */
export function droneOwnLoadout(entity: SURefMetaEntity): {
  systems: SURefEntity[]
  modules: SURefEntity[]
} {
  const names = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((n): n is string => typeof n === 'string') : []
  return resolveLoadout(
    names('systems' in entity ? entity.systems : undefined),
    names('modules' in entity ? entity.modules : undefined)
  )
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
export function isGrantingAbility(entity: SURefMetaEntity): boolean {
  return isAbility(entity) && resolveGrantedEntities(entity as SURefEntity).length > 0
}

/**
 * An entity's actions, split: the folded self-action, and every other visible
 * one (titanic ones included). A granting ability has none of its own.
 */
export function entityActions(
  entity: SURefMetaEntity,
  entityName: string
): { folded: SURefMetaAction | undefined; others: SURefMetaAction[] } {
  if ('actionSource' in entity || isGrantingAbility(entity))
    return { folded: undefined, others: [] }
  const visible = extractVisibleActions(entity) ?? []
  const folded = foldedActionOf(
    visible.filter((a) => !isTitanicAction(a)),
    entityName
  )
  return { folded, others: visible.filter((a) => a !== folded) }
}
