/**
 * "Add from Training Bay", the pure half: what is on offer, what a pick of
 * several moves, and which assignments come through the move.
 *
 * A pilot and the mech assigned to them are offered as one line and move as
 * one: a move prunes every link that would straddle two containers (ADR-037),
 * so the pair's link is redrawn once both ends are in the Game. So is any
 * other link whose two ends both move (a crawler with its crew). A link with
 * one end left behind is cleared, and the dialog says so before it moves.
 */

import type { ContainerFields } from 'game-domain/container'
import { containerOf } from 'game-domain/container'
import type { EntityKind } from 'game-domain/entityKinds'
import type { SoftLink } from 'game-domain/schemas/softLink'

type Held = ContainerFields & { id: string; name: string }

/** One unit that may move in. */
export type Movable = { id: string; name: string; kind: EntityKind }

/** A line of the dialog: a unit, and the mech that moves with a pilot. */
export type BringChoice = Movable & { mech: Movable | null }

type LinkEnds = Pick<SoftLink, 'type' | 'from' | 'to'>

/**
 * What the Training Bay offers this Game: its pilots (each with the mech
 * assigned to them), the mechs no pilot of the bay flies, and its crawlers
 * when the viewer may bring one. `owned` counts every pilot and mech the
 * player has anywhere, so an empty dialog can tell "you have built nothing"
 * from "it is all in a Game already".
 */
export function bringChoices(args: {
  pilots: readonly (Held & { label?: string })[]
  mechs: readonly Held[]
  crawlers: readonly Held[]
  softLinks: readonly LinkEnds[]
  /** The viewer may bring a crawler: they run this Game and it has none. */
  crawler: boolean
}): { pilots: BringChoice[]; mechs: BringChoice[]; crawlers: BringChoice[]; owned: number } {
  const onShelf = <T extends Held>(list: readonly T[]) =>
    list.filter((e) => containerOf(e).kind === 'shelf')
  const mechs = onShelf(args.mechs)
  const flown = new Map<string, Movable>()
  for (const link of args.softLinks) {
    if (link.type !== 'mech-to-pilot') continue
    const mech = mechs.find((m) => m.id === link.from.id)
    if (mech) flown.set(link.to.id, { id: mech.id, name: mech.name, kind: 'mech' })
  }
  const paired = new Set([...flown.values()].map((m) => m.id))
  const pilots = onShelf(args.pilots).map(
    (p): BringChoice => ({
      id: p.id,
      name: p.label ?? p.name,
      kind: 'pilot',
      mech: flown.get(p.id) ?? null,
    })
  )
  // A mech whose pilot is on offer rides that pilot's line, not its own.
  const offered = new Set(pilots.flatMap((p) => (p.mech ? [p.mech.id] : [])))
  return {
    pilots,
    mechs: mechs
      .filter((m) => !(paired.has(m.id) && offered.has(m.id)))
      .map((m): BringChoice => ({ id: m.id, name: m.name, kind: 'mech', mech: null })),
    crawlers: args.crawler
      ? onShelf(args.crawlers).map(
          (c): BringChoice => ({ id: c.id, name: c.name, kind: 'crawler', mech: null })
        )
      : [],
    owned: args.pilots.length + args.mechs.length,
  }
}

/**
 * What a pick moves: each picked line's unit and a pilot's mech with it, the
 * crawler first (the one a Game may refuse), and the links to redraw once
 * they are all in the Game: those whose two ends both move.
 *
 * `pair` (LG2-07): one pilot with no mech and one mech with no pilot, picked
 * together, are plainly each other's, so the mech is assigned to the pilot on
 * arrival. Two of either, and nobody can say whose is whose: nothing is assumed.
 */
export function bringPlan<L extends LinkEnds>(
  picked: readonly BringChoice[],
  softLinks: readonly L[]
): { moves: Movable[]; keep: L[]; pair: { mech: Movable; pilot: Movable } | null } {
  const onFoot = picked.filter((c) => c.kind === 'pilot' && c.mech === null)
  const flown = new Set(softLinks.filter((l) => l.type === 'mech-to-pilot').map((l) => l.from.id))
  const free = picked.filter((c) => c.kind === 'mech' && !flown.has(c.id))
  const [pilot, mech] = [onFoot[0], free[0]]
  const pair =
    onFoot.length === 1 && free.length === 1 && pilot !== undefined && mech !== undefined
      ? { mech: unitOf(mech), pilot: unitOf(pilot) }
      : null
  const units = picked.flatMap((choice): Movable[] => {
    const { mech, ...unit } = choice
    return mech === null ? [unit] : [unit, mech]
  })
  const rank = (m: Movable) => (m.kind === 'crawler' ? 0 : m.kind === 'pilot' ? 1 : 2)
  const moves = [...units].sort((a, b) => rank(a) - rank(b))
  const moving = new Set(moves.map((m) => m.id))
  return {
    moves,
    keep: softLinks.filter((l) => moving.has(l.from.id) && moving.has(l.to.id)),
    pair,
  }
}

const unitOf = ({ id, name, kind }: BringChoice): Movable => ({ id, name, kind })
