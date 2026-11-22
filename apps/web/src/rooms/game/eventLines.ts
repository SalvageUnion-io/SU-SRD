/**
 * How a vital's line reads in the table's event stream (`events.ts`): the
 * unit, with a mech's pilot beside it, the change, and "· Undo" when a
 * toast's Undo wrote it.
 */

import { pilotCallsign } from 'game-domain/pilotLabel'
import { seatOf } from '../seats'
import type { GameStore } from './store'

/**
 * The source of an op a toast's Undo wrote (`replica/provenance.ts`'s
 * `PLAY_UNDO`): its line says so, so the table reads a hit taken back as
 * taken back, never as a second change (r3 B2).
 */
export const UNDO_SOURCE = 'play-undo'

/** A vital's change as an event stores it. */
export type VitalChange = {
  who: string
  label: string
  from: number | null
  to: number
  undo?: true
}

export function vitalLine(v: VitalChange): string {
  const line =
    v.from === null
      ? `${v.who} · ${v.label} → ${v.to}`
      : `${v.who} · ${v.label} ${v.from} → ${v.to}`
  return v.undo === true ? `${line} · Undo` : line
}

/**
 * A unit as a vital's line names it: a mech (`label`) with its pilot, "Reaper
 * (GHOST)", whoever is aboard, else whoever it is assigned to (r3 B2).
 */
export function crewedLabel(store: GameStore, unitId: string, label: string): string {
  if (store.unit(unitId)?.kind !== 'mech') return label
  const aboard = store
    .rows('select * from seats')
    .map(seatOf)
    .find((seat) => seat.mount.kind === 'boarded' && seat.mount.mechId === unitId)?.pilotId
  const pilotId =
    aboard ?? store.linksTouching(unitId).find((link) => link.type === 'mech-to-pilot')?.to.id
  const pilot = pilotId === undefined ? null : store.unit(pilotId)
  return pilot === null ? label : `${label} (${pilotCallsign(pilot.body)})`
}
