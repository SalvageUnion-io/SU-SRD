/**
 * Group Initiative (Core Book p.235–236), as Mediate tracks it (r6 B4): play
 * alternates between the groups of an action scene, one of each taking a turn
 * at a time; someone who has acted waits for the next round; when everyone
 * has, a new round starts and the Group Initiative Table says who acts first.
 *
 * A tracker the Mediator moves, never a turn system (ARCHITECTURE.md#combat):
 * nothing here refuses a turn, ends a round or moves a side on its own. The
 * Mediator presses Next side and New round; a pilot's mark fills when their
 * turn ends (`scenes.endTurn`) or the turn is given to someone else.
 *
 * `INITIATIVE_MODE` is the one switch: `rounds` (the sides, the round and who
 * goes first) or `acted` (only who has acted, cleared by New round).
 */

import { z } from 'salvageunion-reference/zod'

export const INITIATIVE_MODE: 'rounds' | 'acted' = 'rounds'

/** The Pilots' side: the player group is always one group (p.236). */
export const PILOTS_SIDE = 'pilots'

/** The Opposition no encounter group holds, as one side: as few groups as possible (p.236). */
export const OPPOSITION_SIDE = 'opposition'

/** The longest id a tracker keeps: an id, never prose. */
const ID = z.string().min(1).max(128)

/** The tracker as the room keeps it. `side` unset: who acts first is not yet said. */
export const InitiativeSchema = z
  .object({
    round: z.number().int().min(1).max(999),
    side: ID.optional(),
    /** The pilots and opposition units that have taken their turn this round. */
    acted: z.array(ID).max(200),
  })
  .strict()

export type Initiative = z.infer<typeof InitiativeSchema>

export type InitiativeSide = {
  id: string
  name: string
  /** Who acts for it: pilots, or the units still standing. */
  members: readonly { id: string; name: string }[]
}

/**
 * Who acts first on a Group Initiative roll (p.236): on 11 and up a Pilot
 * (two on a 20), on 10 and under an NPC (two on a 1).
 */
export function firstSideOf(total: number): 'pilots' | 'opposition' {
  return total >= 11 ? 'pilots' : 'opposition'
}

/**
 * The sides of the action scene: the Pilots, then each opposition group in
 * the tray's order, the units in none as one more. A downed unit takes no
 * turn, so it is in none; a side with nobody standing is left out.
 */
export function initiativeSides(
  pilots: readonly { id: string; name: string }[],
  units: readonly {
    id: string
    name: string
    down: boolean
    group: { id: string; name: string } | null
  }[],
  names: { pilots: string; opposition: string }
): InitiativeSide[] {
  const groups = new Map<
    string,
    { id: string; name: string; members: { id: string; name: string }[] }
  >()
  const alone: { id: string; name: string }[] = []
  for (const unit of units) {
    if (unit.down) continue
    const member = { id: unit.id, name: unit.name }
    if (unit.group === null) {
      alone.push(member)
      continue
    }
    const known = groups.get(unit.group.id)
    if (known) known.members.push(member)
    else groups.set(unit.group.id, { ...unit.group, members: [member] })
  }
  return [
    { id: PILOTS_SIDE, name: names.pilots, members: pilots },
    ...groups.values(),
    ...(alone.length > 0 ? [{ id: OPPOSITION_SIDE, name: names.opposition, members: alone }] : []),
  ]
}

/** The side a first-side answer names here: the Pilots, or the first of the opposition. */
export function sideFor(first: 'pilots' | 'opposition', sides: readonly InitiativeSide[]): string {
  if (first === 'pilots') return PILOTS_SIDE
  return sides.find((side) => side.id !== PILOTS_SIDE)?.id ?? PILOTS_SIDE
}

/** The side after `current`, round the table; the first when `current` is gone. */
export function nextSide(sides: readonly InitiativeSide[], current: string | undefined): string {
  const at = sides.findIndex((side) => side.id === current)
  return sides[(at + 1) % sides.length]?.id ?? PILOTS_SIDE
}

/** A new round: the first, or the one after `previous`; nobody acted, who goes first not yet said. */
export function newRound(previous: Initiative | null): Initiative {
  return { round: previous === null ? 1 : previous.round + 1, acted: [] }
}

/** Mark `id` as having acted this round, or not. */
export function withActed(initiative: Initiative, id: string, acted: boolean): Initiative {
  const rest = initiative.acted.filter((one) => one !== id)
  return { ...initiative, acted: acted ? [...rest, id] : rest }
}

/** Everyone standing has acted: the round is over, for the Mediator to start the next. */
export function roundDone(initiative: Initiative, sides: readonly InitiativeSide[]): boolean {
  const all = sides.flatMap((side) => side.members.map((member) => member.id))
  return all.length > 0 && all.every((id) => initiative.acted.includes(id))
}
