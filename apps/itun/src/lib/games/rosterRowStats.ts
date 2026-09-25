/**
 * What a Game roster row states as `label | value` — pure, so the roster
 * component only lays the stats out (split from `GameRoster.tsx`, audit AP-16).
 */

import { resolveChassisRef } from 'salvageunion-reference/rules'
import { resolveClassName } from '../classRef'
import type { RosterRow } from './gameRoster'

/**
 * Everything the row states as `label | value`, all of it in the header band.
 *
 * There is no second place for these any more: a stat is a stat whether it is a
 * number or a name, so `CLASS | Salvager` sits in the band beside `SP | 12`
 * rather than in a separate register below it. The body is left to the verbs.
 *
 * **HP and AP are deliberately absent.** A roster answers "what have I got",
 * not "how hurt is it": live vitals belong to the sheet and the Dashboard, and
 * a number that changes every round is stale on a listing the moment it renders.
 * Absent numbers are omitted, never zeroed.
 */
export function rosterRowStats(row: RosterRow): Array<{ label: string; value: string | number }> {
  const num = (key: string): number | undefined => {
    const value = row.body[key]
    return typeof value === 'number' ? value : undefined
  }
  const out: Array<{ label: string; value: string | number }> = []

  if (row.kind === 'pilot') {
    // What the pilot IS — the class leads, the callsign names them.
    const className = resolveClassName(String(row.body.classRef ?? ''))
    if (className) out.push({ label: 'Class', value: className })
    const callsign = row.body.callsign
    if (typeof callsign === 'string' && callsign.length > 0 && callsign !== row.name) {
      out.push({ label: 'Callsign', value: callsign })
    }
  }
  if (row.kind === 'mech') {
    // The chassis leads: it is what the mech IS, where SP and Heat are how it
    // is doing. Rendered as `CHASSIS | Iron Mongrel` rather than a bare chip,
    // so the name arrives labelled.
    const chassis = row.body.chassisRef
    if (typeof chassis === 'string' && chassis.length > 0) {
      const resolved = chassisOf(chassis)
      out.push({ label: 'Chassis', value: resolved.name })
      // TL is its own stat rather than a suffix on the chassis value: two facts
      // crammed into one value box is the thing `Stat` exists to stop.
      if (resolved.techLevel != null) out.push({ label: 'TL', value: resolved.techLevel })
    }
    if (num('currentSP') !== undefined) out.push({ label: 'SP', value: num('currentSP') as number })
    if (num('currentHeat') !== undefined) {
      out.push({ label: 'Heat', value: num('currentHeat') as number })
    }
  }
  if (row.kind === 'crawler') {
    const tl = String(row.body.techLevel ?? '').replace(/[^0-9]/g, '')
    if (tl) out.push({ label: 'TL', value: tl })
    const bays = Array.isArray(row.body.crawlerBays) ? row.body.crawlerBays.length : 0
    out.push({ label: 'Bays', value: bays })
  }
  return out
}

/**
 * A mech's chassis, resolved. The stored value is a SLUG, and printing the slug
 * is the surface admitting it never looked the chassis up — the home Roster has
 * always resolved it, and this said "iron-mongrel" where that said "Iron
 * Mongrel".
 */
function chassisOf(chassisRef: string): { name: string; techLevel?: number } {
  // `resolveChassisRef` throws when the Chassis model is not preloaded (test
  // and snapshot contexts), so this falls back rather than taking the screen
  // down with it — the same guard the Roster's `mechChassisMeta` uses.
  try {
    const chassis = resolveChassisRef(chassisRef) as { name: string; techLevel?: number } | null
    return chassis ?? { name: chassisRef }
  } catch {
    return { name: chassisRef }
  }
}
