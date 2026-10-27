import type { EntityKind } from 'game-domain/entityKinds'
import type { LinkShape } from 'game-domain/links/linkRules'
import type { Op } from './ops'

/**
 * Moving a unit between two rooms: an account room (a player's Training Bay)
 * and a Game room, or two Game rooms.
 *
 * No transaction spans two Durable Objects, so a move is a two-step handoff
 * under a lease, and a unit is never in two homes or none:
 *
 * 1. **offer**: the source checks the actor may take the unit out, marks it
 *    leaving (refusing every write to it from then on) and hands back a
 *    parcel: the unit, its op log, its links and, for a pilot, its seat.
 * 2. **accept**: the target checks the actor may bring it in and stores it.
 *    Accepting the same lease twice is a no-op.
 * 3. **release**: the source drops the unit, its links and its seat.
 *
 * A refused accept cancels the offer and the unit stays where it was. A
 * handoff cut off between the steps (a Worker evicted mid-move) is finished
 * by `settleLease`, which the source's alarm runs for every stale offer
 * (`GameTransit.staleOffers`). It asks the target to refuse the lease, in one call that
 * answers whether the target had already taken the unit: if it had, the
 * source releases it; if not, the lease is refused for good and the source
 * takes the unit back. A late accept then fails, so the unit cannot land
 * twice.
 *
 * "Make a copy" is not a move: it is a new unit with a new id, created where
 * the copy goes.
 */

/** Where a unit lives: a player's account room, or a Game's room. */
export type HomeAddress = { kind: 'account'; userId: string } | { kind: 'game'; gameId: string }

/** A unit in flight, as the source hands it to the target. */
export type UnitParcel = {
  leaseId: string
  from: HomeAddress
  unit: {
    id: string
    kind: EntityKind
    /** Its holder; null for a Game's communal crawler or an unassigned unit. */
    ownerId: string | null
    body: Record<string, unknown>
    headSeq: number
    fieldSeqs: Record<string, number>
    publicRead: boolean
  }
  /** Its op log, applied and pending, so its history travels with it (ADR-063). */
  ops: Op[]
  /** Every link touching it at the source; the target keeps those whose other end it holds. */
  links: LinkShape[]
  /** A pilot's seat at the source, so play carries over. */
  seat: ParcelSeat | null
}

/** The part of a seat that travels with its pilot. */
export type ParcelSeat = {
  mount: { kind: 'foot' } | { kind: 'boarded'; mechId: string }
  range: string
  activeEffects: string[]
  ejected: boolean
}

/** What a target says when asked to refuse a lease: it had already taken the unit, or now never will. */
export type LeaseOutcome = 'accepted' | 'refused'

type Awaitable<T> = T | Promise<T>

/**
 * One side of a handoff. The Game room implements both halves, and so does
 * the account room; the Worker calls them over the rooms' RPC stubs.
 */
export type UnitHome = {
  offer(args: {
    leaseId: string
    unitId: string
    actor: string
    to: HomeAddress
    at: number
  }): Awaitable<UnitParcel>
  accept(parcel: UnitParcel, actor: string, at: number): Awaitable<void>
  release(leaseId: string): Awaitable<void>
  cancel(leaseId: string): Awaitable<void>
  /** Refuse `leaseId` from now on, unless it was already accepted; say which. */
  refuseLease(leaseId: string, at: number): Awaitable<LeaseOutcome>
}

/**
 * Move `unitId` from `source` to `target` for `actor`. Throws the target's
 * refusal, if it refused, after taking the unit back. An accept that failed
 * on the wire after the target stored the unit still completes the move.
 */
export async function handOff(
  source: UnitHome,
  target: UnitHome,
  args: { leaseId: string; unitId: string; actor: string; to: HomeAddress; at: number }
): Promise<void> {
  const parcel = await source.offer(args)
  try {
    await target.accept(parcel, args.actor, args.at)
  } catch (error) {
    if ((await settleLease(source, target, args.leaseId, args.at)) === 'released') return
    throw error
  }
  await source.release(args.leaseId)
}

/** Finish a handoff left between its steps, whichever way it went. */
export async function settleLease(
  source: UnitHome,
  target: UnitHome,
  leaseId: string,
  at: number
): Promise<'released' | 'cancelled'> {
  if ((await target.refuseLease(leaseId, at)) === 'accepted') {
    await source.release(leaseId)
    return 'released'
  }
  await source.cancel(leaseId)
  return 'cancelled'
}
