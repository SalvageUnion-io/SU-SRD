/**
 * What a downed Opposition leaves to salvage (Core Book pp.245–246, 248), as
 * the Mediator's Salvage control on its box reads it. Pure apart from the
 * reference lookups.
 *
 *  - **A Mech** is salvaged on the Mech Salvage table: its Chassis, and the
 *    Systems and Modules its pattern mounts, each at its own Tech Level and
 *    Salvage Value (`WreckPart`).
 *  - **A Vehicle** is scrapped for its Salvage Value in Scrap of its Tech
 *    Level (p.246). Which of its Systems or Modules can be salvaged is the
 *    Mediator's call, so none is offered here.
 *  - Everything else (NPCs, squads, creatures, Bio-Titans, Meld) leaves no
 *    salvage the rules price in Scrap of Tech 1–6.
 */

import { nameToSlug } from 'salvageunion-reference'
import type { WreckPart } from '../../lib/rules/downtimeEconomy'
import { installed, patternItem } from './npcActions.model'
import type { TrayNpc } from './opposition.model'

export type Wreck =
  | { kind: 'mech'; parts: WreckPart[] }
  | { kind: 'scrap'; techLevel: number; salvageValue: number }

/** A Tech Level the scrap pool has a bucket for, or undefined. */
function tierOf(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 6
    ? value
    : undefined
}

function salvageValueOf(value: unknown): number {
  return typeof value === 'number' && value > 0 ? value : 0
}

/** The salvage a tray NPC leaves once down, or null when it leaves none. */
export function wreckOf(npc: Pick<TrayNpc, 'refSchema' | 'entity' | 'pattern'>): Wreck | null {
  if (npc.entity === null) return null
  const entity: Record<string, unknown> = { ...npc.entity }
  if (npc.refSchema === 'vehicles') {
    const techLevel = tierOf(entity.techLevel)
    const salvageValue = salvageValueOf(entity.salvageValue)
    return techLevel === undefined || salvageValue === 0
      ? null
      : { kind: 'scrap', techLevel, salvageValue }
  }
  if (npc.refSchema !== 'chassis') return null
  const parts: WreckPart[] = [
    {
      key: 'chassis',
      kind: 'chassis',
      name: String(entity.name ?? 'Chassis'),
      techLevel: tierOf(entity.techLevel),
      salvageValue: salvageValueOf(entity.salvageValue),
    },
  ]
  for (const [schema, kind] of [
    ['systems', 'system'],
    ['modules', 'module'],
  ] as const) {
    installed(npc.pattern, schema).forEach((name, i) => {
      const item: Record<string, unknown> = { ...(patternItem(schema, name) ?? {}) }
      parts.push({
        key: `${kind}:${i}:${nameToSlug(name)}`,
        kind,
        name: typeof item.name === 'string' ? item.name : name,
        techLevel: tierOf(item.techLevel),
        salvageValue: salvageValueOf(item.salvageValue),
      })
    })
  }
  return { kind: 'mech', parts }
}
