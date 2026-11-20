/**
 * The `label | value` stats a roster row carries in its band — shared by the
 * player's Roster and the Starter Set, so the two read identically.
 */

import type { UnitReading } from '../../lib/units/unitModel'

/**
 * A pilot row's header stats: `CLASS | Scavenger`, `CALLSIGN | Ghost`.
 *
 * These lived in the body as tone-tinted chips. They are `label | value` facts
 * like any other, so they belong in the band with the rest, on the plain ink
 * label plate every other stat uses — the tint was a second way of saying what
 * the band already says.
 *
 * No HP/AP here: a roster answers "what have I got", not "how hurt is it".
 */
/**
 * A built NPC's row stats: its role and its max HP (or SP), `ROLE | Doc`,
 * `HP | 4`. Max, not current: a roster answers what you have.
 */
export function npcStats(npc: {
  position?: string
  hitPoints: number
  damageType: 'HP' | 'SP'
}): UnitReading[] {
  const stats: UnitReading[] = []
  if (npc.position?.trim()) stats.push({ label: 'Role', value: npc.position.trim(), chip: 'mark' })
  stats.push({ label: npc.damageType, value: npc.hitPoints, chip: 'measure' })
  return stats
}
