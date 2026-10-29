/**
 * What a downed Opposition leaves to salvage (`game-domain/rules/wreck`), as
 * the Mediator's Salvage control on its box reads it: the tray NPC's entity
 * and the Systems and Modules its pattern mounts, read from the reference.
 */

import type { Wreck } from 'game-domain/rules/wreck'
import { wreckOf as wreckFrom } from 'game-domain/rules/wreck'
import { installed, patternItem } from './npcActions.model'
import type { TrayNpc } from './opposition.model'

/** The salvage a tray NPC leaves once down, or null when it leaves none. */
export function wreckOf(npc: Pick<TrayNpc, 'refSchema' | 'entity' | 'pattern'>): Wreck | null {
  if (npc.entity === null) return null
  const mounted = (
    [
      ['systems', 'system'],
      ['modules', 'module'],
    ] as const
  ).flatMap(([schema, kind]) =>
    installed(npc.pattern, schema).map((name) => ({
      kind,
      name,
      item: { ...(patternItem(schema, name) ?? {}) } as Record<string, unknown>,
    }))
  )
  return wreckFrom(npc.refSchema, { ...npc.entity }, mounted)
}
