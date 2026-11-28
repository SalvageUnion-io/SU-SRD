/**
 * Mediate's Group Initiative sides (r6 B4), read off the screen's own state:
 * its seats, then the tray's units standing (`initiativeSides`). The
 * opposition is one side but for the encounter groups the Mediator split off
 * (r7 C4); without the encounter sheet (`encounterSheet`) there are no groups.
 */

import { flagOn } from '../../lib/flags'
import type { Initiative, InitiativeSide } from '../../lib/rules/initiative'
import { INITIATIVE_MODE, initiativeSides } from '../../lib/rules/initiative'
import { mediatorCopy } from '../../messages/play-mediator'
import type { PlayMediator } from './usePlayMediator'

/** What the sides are read from: the seats, then the tray's units. */
export type SidesOf = Pick<PlayMediator, 'seats' | 'npcs'>

/**
 * The owner's ruling on the opposition's sides (r7 C4, MD7-05): `true`, every
 * enemy on the field is one Opposition side, however prep added them, and the
 * Mediator splits a group off as its own side (Core Book p.236, the tracker's
 * `split`); `false`, each encounter group is a side of its own, as round six did.
 */
export const ONE_OPPOSITION = true

export function mediatorSides(mediator: SidesOf, split: readonly string[] = []): InitiativeSide[] {
  const grouping = flagOn('encounterSheet')
  const ownSide = (group: { id: string } | null) =>
    grouping && group !== null && (!ONE_OPPOSITION || split.includes(group.id))
  return initiativeSides(
    mediator.seats.map((seat) => ({ id: seat.pilotId, name: seat.name })),
    (mediator.npcs ?? []).map((npc) => ({ ...npc, group: ownSide(npc.group) ? npc.group : null })),
    { pilots: mediatorCopy('pilotsSide'), opposition: mediatorCopy('oppositionSide') }
  )
}

/** The encounter groups standing on the field, each once: the ones a side can be split off for. */
export function fieldGroups(mediator: SidesOf): { id: string; name: string }[] {
  if (!ONE_OPPOSITION || !flagOn('encounterSheet')) return []
  const groups = new Map<string, { id: string; name: string }>()
  for (const npc of mediator.npcs ?? []) {
    if (!npc.down && npc.group !== null && !groups.has(npc.group.id))
      groups.set(npc.group.id, npc.group)
  }
  return [...groups.values()]
}

/**
 * The owner's ruling on turn bookkeeping (r7 C3, MD7-04): `true`, an NPC's
 * rolled action marks it Acted, and a side whose units have all acted passes
 * play to the next side still to act, each step with Undo on the tracker;
 * `false` leaves both to the Mediator's presses, as round six did.
 */
export const TURNS_RUN_THEMSELVES = true

/**
 * The tracker once play passes on (r7 C3): the side to act has all acted, and
 * another has not, so that one is up. Null when nothing passes: rounds are
 * not kept, nobody is up, someone on the side is still to act, or the round
 * is over (New round is then the tracker's one button).
 */
export function passedSide(
  initiative: Initiative,
  sides: readonly InitiativeSide[]
): Initiative | null {
  if (!TURNS_RUN_THEMSELVES || INITIATIVE_MODE !== 'rounds') return null
  const at = sides.findIndex((side) => side.id === initiative.side)
  const current = sides[at]
  if (current === undefined) return null
  const done = (side: InitiativeSide) =>
    side.members.every((member) => initiative.acted.includes(member.id))
  if (!done(current)) return null
  for (let step = 1; step < sides.length; step++) {
    const next = sides[(at + step) % sides.length]
    if (next !== undefined && !done(next)) return { ...initiative, side: next.id }
  }
  return null
}
