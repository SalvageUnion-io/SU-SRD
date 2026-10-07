import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { query } from './_generated/server'
import { assertMayWrite } from './entities'
import { linkIdOf, mutation, resolveLinkEnd, rowsInGame } from './model/entities'
import { NotAuthorized, requireMember, requireUser } from './model/permissions'
import type { SeatState } from './model/seats'
import { defaultSeat, readSeat, seatsInGame } from './model/seats'
import { seatRange, seatResolving } from './schema'

/**
 * Seats: each pilot's play state in a Game, shared with the crew and saved on
 * the Game ([ADR-038](../../../docs/ARCHITECTURE.md#adr-038) §2;
 * docs/architecture/dashboard-redesign.md §3).
 *
 * A seat says whether its pilot is on foot or boarded (and in which mech), the
 * range band they declared, which activated effects are switched on, and the
 * deck action they are resolving, if any (plan §8 A6: the crew watches it
 * live, and a reload mid-roll keeps the roll), and whether they ejected (plan
 * D6: the Crew tab flags it). It is keyed on the pilot, not the member, so a member covering for an absent player
 * runs two. Mount never becomes a field on a pilot or mech: a seat is its own
 * row that points at both by app id.
 *
 * - **Every member reads every seat** (`forGame`). A seat holds nothing a
 *   crewmate isn't entitled to see.
 * - **Only someone who may write the pilot writes its seat**, through
 *   `assertMayWrite`. The Mediator does not; they propose, as everywhere else
 *   (ADR-030 §4).
 * - **Boarding also needs write access to the mech**, because playing a mech
 *   writes its Heat, EP and SP. Boarding never assigns: the pilot's
 *   `mech-to-pilot` link is untouched.
 * - **Rows are created lazily**, on the first write, like `downtime`'s row. A
 *   pilot without one reads as on foot, at Close, with nothing switched on.
 * - **A change of mount ends a resolve.** The deck it came from is gone, so
 *   board, dismount and eject clear `resolving` whenever the mount moves.
 *
 * Cleanup lives with the paths that would orphan a seat (`model/seats.ts`).
 */

/**
 * A pilot in this Game whose seat the caller may write, or a refusal.
 *
 * Membership is checked first, so a non-member learns nothing about what the
 * Game holds. The pilot is addressed the way a link end is (`resolveLinkEnd`),
 * which also finds a template-seeded pilot by the id in its body.
 */
async function writablePilot(
  ctx: MutationCtx,
  gameId: Id<'games'>,
  pilotId: string
): Promise<{ userId: Id<'users'>; pilot: Doc<'pilots'> }> {
  const userId = await requireUser(ctx)
  await requireMember(ctx, gameId)
  const row = await resolveLinkEnd(ctx, { type: 'pilot', id: pilotId }, gameId)
  if (row === null || row.gameId !== gameId) {
    throw new NotAuthorized('That pilot is not in this game')
  }
  // A `pilot` end only ever resolves to a row of the `pilots` table.
  const pilot = row as Doc<'pilots'>
  assertMayWrite(pilot, userId)
  return { userId, pilot }
}

/** Write part of a seat, creating its row on first use. */
async function writeSeat(
  ctx: MutationCtx,
  gameId: Id<'games'>,
  pilotId: string,
  change: (seat: SeatState) => Partial<SeatState>
): Promise<void> {
  const existing = await readSeat(ctx, gameId, pilotId)
  const updatedAt = Date.now()
  if (existing !== null) {
    await ctx.db.patch(existing._id, { ...change(existing), updatedAt })
    return
  }
  const seat = defaultSeat()
  await ctx.db.insert('seats', { gameId, pilotId, ...seat, ...change(seat), updatedAt })
}

const SEAT_ARGS = { gameId: v.id('games'), pilotId: v.string() }

/** Move to `mount`, dropping the resolve in progress if the mount changed. */
function remount(seat: SeatState, mount: SeatState['mount']): Partial<SeatState> {
  const same =
    seat.mount.kind === mount.kind &&
    (mount.kind === 'foot' || (seat.mount.kind === 'boarded' && seat.mount.mechId === mount.mechId))
  return same ? { mount } : { mount, resolving: undefined }
}

/** One pilot's seat as `forGame` returns it: `null`, not absent, for "none yet". */
type SeatRead = Omit<SeatState, 'resolving' | 'ejected'> & {
  pilotId: string
  resolving: NonNullable<SeatState['resolving']> | null
  updatedAt: number | null
}

/**
 * Every pilot's seat in the Game, one entry per pilot in it.
 *
 * A pilot with no row yet gets the default seat, so every caller sees the same
 * answer for "never sat down" without inventing it. Rows for pilots no longer
 * in the Game are not returned; the cleanup paths delete them anyway.
 */
export const forGame = query({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.gameId)
    const [pilots, rows] = await Promise.all([
      rowsInGame(ctx, 'pilot', args.gameId),
      seatsInGame(ctx, args.gameId),
    ])
    const byPilot = new Map(rows.map((row) => [row.pilotId, row]))

    const seats: SeatRead[] = []
    for (const pilot of pilots) {
      const pilotId = linkIdOf(pilot)
      if (pilotId === undefined) continue
      const row = byPilot.get(pilotId)
      seats.push(
        row === undefined
          ? { pilotId, ...defaultSeat(), resolving: null, updatedAt: null }
          : {
              pilotId,
              mount: row.mount,
              range: row.range,
              activeEffects: row.activeEffects,
              resolving: row.resolving ?? null,
              updatedAt: row.updatedAt,
            }
      )
    }
    return seats
  },
})

/**
 * Board a mech.
 *
 * Refused unless the caller may write both the pilot and the mech, the mech is
 * in this Game and not destroyed, and no other seat is boarded in it. Boarding
 * a mech the pilot is already in is a no-op that still succeeds.
 */
export const board = mutation({
  args: { ...SEAT_ARGS, mechId: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const { userId } = await writablePilot(ctx, args.gameId, args.pilotId)

    const row = await resolveLinkEnd(ctx, { type: 'mech', id: args.mechId }, args.gameId)
    if (row === null || row.gameId !== args.gameId) {
      throw new NotAuthorized('That mech is not in this game')
    }
    // A `mech` end only ever resolves to a row of the `mechs` table.
    const mech = row as Doc<'mechs'>
    assertMayWrite(mech, userId)
    if ((mech.body as { destroyed?: unknown }).destroyed === true) {
      throw new NotAuthorized('That mech is destroyed')
    }

    const mechId = linkIdOf(mech) ?? args.mechId
    for (const seat of await seatsInGame(ctx, args.gameId)) {
      if (seat.pilotId === args.pilotId) continue
      if (seat.mount.kind === 'boarded' && seat.mount.mechId === mechId) {
        throw new NotAuthorized('Another pilot is already aboard that mech')
      }
    }

    await writeSeat(ctx, args.gameId, args.pilotId, (seat) => ({
      ...remount(seat, { kind: 'boarded', mechId }),
      ejected: undefined,
    }))
  },
})

/** Climb out of the mech, back on foot. */
export const dismount = mutation({
  args: SEAT_ARGS,
  handler: async (ctx, args): Promise<void> => {
    await writablePilot(ctx, args.gameId, args.pilotId)
    await writeSeat(ctx, args.gameId, args.pilotId, (seat) => ({
      ...remount(seat, { kind: 'foot' }),
      ejected: undefined,
    }))
  },
})

/**
 * Eject: the emergency exit, which leaves the pilot on foot as Dismount does,
 * and marks the seat `ejected` so the crew sees it (`crew.vitals`) until the
 * pilot next boards or dismounts.
 *
 * Its own function because it is its own act at the table: the player confirms
 * it on the Dashboard (ADR-007), and nothing ever ejects a pilot for them.
 */
export const eject = mutation({
  args: SEAT_ARGS,
  handler: async (ctx, args): Promise<void> => {
    await writablePilot(ctx, args.gameId, args.pilotId)
    await writeSeat(ctx, args.gameId, args.pilotId, (seat) => ({
      ...remount(seat, { kind: 'foot' }),
      ejected: true,
    }))
  },
})

/** Declare the engagement range band. */
export const setRange = mutation({
  args: { ...SEAT_ARGS, range: seatRange },
  handler: async (ctx, args): Promise<void> => {
    await writablePilot(ctx, args.gameId, args.pilotId)
    await writeSeat(ctx, args.gameId, args.pilotId, () => ({ range: args.range }))
  },
})

/**
 * Switch an activated effect on or off, by the ref of the record that declares
 * it (ADR-029 §4). Expiry is manual: the table keeps time, the app keeps state.
 */
export const toggleEffect = mutation({
  args: { ...SEAT_ARGS, ref: v.string() },
  handler: async (ctx, args): Promise<void> => {
    await writablePilot(ctx, args.gameId, args.pilotId)
    await writeSeat(ctx, args.gameId, args.pilotId, (seat) => ({
      activeEffects: seat.activeEffects.includes(args.ref)
        ? seat.activeEffects.filter((ref) => ref !== args.ref)
        : [...seat.activeEffects, args.ref],
    }))
  },
})

/**
 * Record the deck action being resolved and how far it has got: opened,
 * activated, rolled (with the roll) or applied. Each step replaces the last,
 * so the crew sees the resolve as it happens and a reload finds the roll.
 *
 * The roll itself is the client's: rules math is pure and runs where the
 * player presses Roll (ADR-006). The seat records it; the Game's change log
 * keeps it after the resolve is over.
 */
export const setResolving = mutation({
  args: { ...SEAT_ARGS, resolving: seatResolving },
  handler: async (ctx, args): Promise<void> => {
    await writablePilot(ctx, args.gameId, args.pilotId)
    await writeSeat(ctx, args.gameId, args.pilotId, () => ({ resolving: args.resolving }))
  },
})

/** The resolve is over: back to the deck. */
export const clearResolving = mutation({
  args: SEAT_ARGS,
  handler: async (ctx, args): Promise<void> => {
    await writablePilot(ctx, args.gameId, args.pilotId)
    await writeSeat(ctx, args.gameId, args.pilotId, () => ({ resolving: undefined }))
  },
})
