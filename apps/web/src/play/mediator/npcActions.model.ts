/**
 * The chosen NPC's actions, flattened like a player's list (play.md §10): every
 * action the reference gives the NPC's entity (an NPC's, a squad's, a
 * Bio-Titan's, a chassis's abilities), and for a mech drawn as a pattern each
 * of the pattern's Systems and Modules, sorted by action type as the player's
 * list sorts them (`typeRank`: Turn, Short, Long, Reaction, Free, …), each in
 * its book order. Pure apart from the reference lookups.
 */

import type { RefEntity, RefMetaAction, RefMetaEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { ActionTypeKey } from '../playActions.model'
import { actionTypeOf, typeRank } from '../playActions.model'
import type { TrayNpc } from './opposition.model'

/** One NPC action as its row draws it. */
export type NpcAction = {
  key: string
  name: string
  type: ActionTypeKey
  action: RefMetaAction
  /** Whose it is: the entity, or the pattern's System or Module. */
  source: string
}

function actionsOf(entity: RefMetaEntity): RefMetaAction[] {
  return (SalvageUnionReference.resolveActions(entity) ?? []).filter((a) => !a.hidden)
}

/** A pattern's System or Module by its printed name. */
export function patternItem(schema: 'systems' | 'modules', name: string): RefMetaEntity | null {
  return SalvageUnionReference.getByNameIn(schema, name) ?? null
}

/** The names a pattern installs, in its order, for one schema. */
export function installed(pattern: TrayNpc['pattern'], key: 'systems' | 'modules'): string[] {
  if (pattern === null || !(key in pattern)) return []
  const list = (pattern as Record<string, unknown>)[key]
  if (!Array.isArray(list)) return []
  return list.flatMap((item: unknown) => {
    if (typeof item === 'string') return [item]
    if (item && typeof item === 'object' && 'name' in item && typeof item.name === 'string') {
      return [item.name]
    }
    return []
  })
}

/** Every action of a tray NPC, sorted by action type. */
export function npcActions(npc: Pick<TrayNpc, 'id' | 'entity' | 'pattern'>): NpcAction[] {
  const entity: RefEntity | null = npc.entity
  if (entity === null) return []
  const owners: { source: string; item: RefMetaEntity }[] = [
    { source: 'name' in entity ? String(entity.name) : 'NPC', item: entity as RefMetaEntity },
  ]
  for (const schema of ['systems', 'modules'] as const) {
    for (const name of installed(npc.pattern, schema)) {
      const item = patternItem(schema, name)
      if (item !== null) owners.push({ source: name, item })
    }
  }
  const all = owners.flatMap(({ source, item }, o) =>
    actionsOf(item).map(
      (action, i): NpcAction => ({
        key: `${npc.id}:${o}:${action.id ?? i}`,
        name: action.name,
        type: actionTypeOf(action),
        action,
        source,
      })
    )
  )
  return all
    .map((entry, i) => ({ entry, i }))
    .sort((a, b) => typeRank(a.entry.type) - typeRank(b.entry.type) || a.i - b.i)
    .map(({ entry }) => entry)
}

/** What an NPC is, as its box's chip says it: NPC, Mech, Squad, Bio-Titan, … */
export function npcKind(npc: Pick<TrayNpc, 'refSchema'>): string {
  switch (npc.refSchema) {
    case 'chassis':
      return 'Mech'
    case 'squads':
      return 'Squad'
    case 'creatures':
      return 'Creature'
    case 'vehicles':
      return 'Vehicle'
    case 'drones':
      return 'Drone'
    case 'bio-titans':
      return 'Bio-Titan'
    case 'meld':
      return 'Meld'
    default:
      return 'NPC'
  }
}
