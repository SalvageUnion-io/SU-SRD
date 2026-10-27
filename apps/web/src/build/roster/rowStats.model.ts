/**
 * The `label | value` stats a roster row carries in its band — shared by the
 * player's Roster and the Starter Set, so the two read identically.
 */

import { parseCrawlerTechLevel, resolveChassisRef } from 'salvageunion-reference/rules'
import { resolveClassName } from '../../lib/classRef'
import { readReference } from '../../lib/readReference'
import type { UnitReading } from '../../lib/units/unitModel'

/**
 * A mech row's stats: `CHASSIS | Iron Mongrel`, and `TL | 1` beside it.
 *
 * Two stats, never one caption string ("Iron Mongrel · TL 1"): two facts joined
 * by a separator is the shape `Stat` exists to replace.
 *
 * resolveChassisRef is slug/name/id tolerant; stored refs are slugs, so a
 * name-only match here would fall through to the raw slug for every mech.
 * `readReference` falls back to the raw ref when the Chassis model isn't
 * preloaded (some test/snapshot contexts) rather than crash.
 */
export function mechChassisStats(chassisRef: string): UnitReading[] | undefined {
  if (!chassisRef) return undefined
  const resolved = readReference(
    'Roster.mechChassisStats',
    () => resolveChassisRef(chassisRef) as { name: string; techLevel?: number } | null,
    null
  )

  const stats: UnitReading[] = [
    { label: 'Chassis', value: resolved?.name ?? chassisRef, chip: 'relation' },
  ]
  if (resolved?.techLevel != null)
    stats.push({ label: 'TL', value: resolved.techLevel, chip: 'rank' })
  return stats
}

/**
 * A crawler row's stats: `TL | 2`. A crawler never lists its count of bays;
 * the crew roster reads the same.
 */
export function crawlerStats(techLevel: string): UnitReading[] {
  const tl = parseCrawlerTechLevel(techLevel)
  return tl === undefined ? [] : [{ label: 'TL', value: String(tl), chip: 'rank' }]
}

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

export function pilotStats(classRef: string, callsign?: string): UnitReading[] | undefined {
  const stats: UnitReading[] = []
  const className = resolveClassName(classRef)
  if (className) stats.push({ label: 'Class', value: className, chip: 'relation' })
  if (callsign) stats.push({ label: 'Callsign', value: callsign, chip: 'mark' })
  return stats.length > 0 ? stats : undefined
}
