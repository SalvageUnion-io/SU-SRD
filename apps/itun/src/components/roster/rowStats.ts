/**
 * The `label | value` stats a roster row carries in its band — shared by the
 * player's Roster and the Starter Set, so the two read identically.
 */

import type { EntityRowStat } from 'component-lib'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import { resolveClassName } from '../../lib/classRef'
import { readReference } from '../../lib/readReference'

/**
 * A mech row's stats: `CHASSIS | Iron Mongrel`, and `TL | 1` beside it.
 *
 * These used to be one caption string, "Iron Mongrel · TL 1" — two facts joined
 * by a separator, which is the shape `Stat` exists to replace. TL is its own
 * stat rather than a suffix for the same reason.
 *
 * resolveChassisRef is slug/name/id tolerant; stored refs are slugs, so a
 * name-only match here would fall through to the raw slug for every mech.
 * `readReference` falls back to the raw ref when the Chassis model isn't
 * preloaded (some test/snapshot contexts) rather than crash.
 */
export function mechChassisStats(chassisRef: string): EntityRowStat[] | undefined {
  if (!chassisRef) return undefined
  const resolved = readReference(
    'Roster.mechChassisStats',
    () => resolveChassisRef(chassisRef) as { name: string; techLevel?: number } | null,
    null
  )

  const stats: EntityRowStat[] = [{ label: 'Chassis', value: resolved?.name ?? chassisRef }]
  if (resolved?.techLevel != null) stats.push({ label: 'TL', value: resolved.techLevel })
  return stats
}

/**
 * A crawler row's stats: `TL | 2`, `BAYS | 3`.
 *
 * Was the caption string "TL 2 · 3 bays" — the same two-facts-one-separator
 * shape the chassis had, and the same fix. These are the labels the crew roster
 * already used, so the two surfaces now read identically.
 */
export function crawlerStats(techLevel: string, bayCount: number): EntityRowStat[] {
  const tl = techLevel.replace(/[^0-9]/g, '')
  const stats: EntityRowStat[] = []
  if (tl) stats.push({ label: 'TL', value: tl })
  stats.push({ label: 'Bays', value: bayCount })
  return stats
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
export function pilotStats(classRef: string, callsign?: string): EntityRowStat[] | undefined {
  const stats: EntityRowStat[] = []
  const className = resolveClassName(classRef)
  if (className) stats.push({ label: 'Class', value: className })
  if (callsign) stats.push({ label: 'Callsign', value: callsign })
  return stats.length > 0 ? stats : undefined
}
