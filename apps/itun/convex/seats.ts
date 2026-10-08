import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { query } from './_generated/server'
import { assertMayWrite } from './entities'
import { linkIdOf, mutation, resolveLinkEnd, rowsInGame } from './model/entities'
import { NotAuthorized, requireMember, requireUser } from './model/permissions'
import type { SeatState } from './model/seats'
import { defaultSeat, readSeat, seatsInGame } from './model/seats'
import { seatRange } from './schema'

/**
 * Seats: each pilot's play state in a Game, shared with the crew and saved on
 * the Game ([ADR-038](../../../docs/ARCHITECTURE.md#adr-038) §2;
 * docs/architecture/dashboard-redesign.md §3).
 *
 * A seat says whether its pilot is on foot or boarded (and in which mech), the
 * range band they declared, and which activated effects are switched on. It is
 * keyed on the pilot, not the member, so a member covering for an absent player
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

    const seats = []
    for (const pilot of pilots) {
      const pilotId = linkIdOf(pilot)
      if (pilotId === undefined) continue
      const row = byPilot.get(pilotId)
      seats.push(
        row === undefined
          ? { pilotId, ...defaultSeat(), updatedAt: null }
          : {
              pilotId,
              mount: row.mount,
              range: row.range,
              activeEffects: row.activeEffects,
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

    await writeSeat(ctx, args.gameId, args.pilotId, () => ({
      mount: { kind: 'boarded', mechId },
    }))
  },
})

/** Climb out of the mech, back on foot. */
export const dismount = mutation({
  args: SEAT_ARGS,
  handler: async (ctx, args): Promise<void> => {
    await writablePilot(ctx, args.gameId, args.pilotId)
    await writeSeat(ctx, args.gameId, args.pilotId, () => ({ mount: { kind: 'foot' } }))
  },
})

/**
 * Eject: the emergency exit, which leaves the pilot on foot as Dismount does.
 *
 * Its own function because it is its own act at the table: the player confirms
 * it on the Dashboard (ADR-007), and nothing ever ejects a pilot for them.
 */
export const eject = mutation({
  args: SEAT_ARGS,
  handler: async (ctx, args): Promise<void> => {
    await writablePilot(ctx, args.gameId, args.pilotId)
    await writeSeat(ctx, args.gameId, args.pilotId, () => ({ mount: { kind: 'foot' } }))
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
