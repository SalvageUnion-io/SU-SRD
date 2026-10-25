import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { query } from './_generated/server'
import { linkIdOf, mutation, oldestByAppId, resolveLinkEnd, rowsInGame } from './model/entities'
import { assertMayWrite } from './model/ownableWrites'
import { membershipOrNull, NotAuthorized, requireMember, requireUser } from './model/permissions'
import { seatMount, seatRange, seatResolving, soloDowntime } from './model/playTables'
import type { SeatPlace, SeatState } from './model/seats'
import { defaultSeat, readSeat, remount, seatsAt, seatsInGame, writeSeat } from './model/seats'

/**
 * Seats: each pilot's play state, at a Game (shared with the crew and saved on
 * the Game, [ADR-038](../../../docs/adr/038-dashboard-game-surface.md) §2) or
 * solo, on its owner's shelf (Play's solo screen).
 *
 * A seat says whether its pilot is on foot or boarded (and in which mech), the
 * range band they declared, which activated effects are switched on, and the
 * deck action they are resolving, if any (the crew watches it live, and a
 * reload mid-roll keeps the roll), and whether they ejected (the Crew tab flags
 * it). It is keyed on the pilot, not the member, so a member covering for an absent player
 * runs two. Mount never becomes a field on a pilot or mech: a seat is its own
 * row that points at both by app id.
 *
 * Every write takes `gameId`: the Game whose seat it is, or null for the
 * pilot's solo seat. The same mutations serve both; only who may write, and
 * where the mech must be, differ (below).
 *
 * - **Every member reads every Game seat** (`forGame`). A seat holds nothing a
 *   crewmate isn't entitled to see. **Only the owner reads a solo seat** (`solo`).
 * - **Only someone who may write the pilot writes its seat**, through
 *   `assertMayWrite`. The Mediator does not; they propose, as everywhere else
 *   (ADR-030 §4). A solo seat's pilot must be on the caller's own shelf.
 * - **Boarding also needs write access to the mech**, because playing a mech
 *   writes its Heat, EP and SP, and the mech must be where the seat is.
 *   Boarding never assigns: the pilot's `mech-to-pilot` link is untouched.
 * - **Rows are created lazily**, on the first write, like `downtime`'s row. A
 *   pilot without one reads as on foot, at Close, with nothing switched on.
 * - **A change of mount ends a resolve.** The deck it came from is gone, so
 *   board, dismount and eject clear `resolving` whenever the mount moves.
 * - **Presence is not here**: it is the Game room's (`src/worker/rooms.ts`).
 *
 * Cleanup lives with the paths that would orphan a seat (`model/seats.ts`).
 */

/*
 * ## Who may read and write which seat
 *
 * `shelfRowOf` and `writablePilot` are exported for `downtime.ts` too,
 * though this is a function module. They are here rather than in
 * `model/seats.ts` because they need `assertMayWrite`, and `ownableWrites`
 * already imports the seat cleanup from there.
 *
 * - **A Game seat** (`gameId` given) is written by whoever may write its pilot
 *   (`assertMayWrite`), after membership: a non-member learns nothing.
 * - **A solo seat** (`gameId` null) is its pilot's owner's alone: the pilot must
 *   be on the caller's own shelf. A pilot in a Game has its seat there.
 */

/**
 * One of `ownerId`'s rows on their shelf, addressed by the id links use
 * (`linkIdOf`), or null.
 *
 * By app id first; then among the owner's own shelf rows, which is where a
 * claimed template pre-gen moved to the shelf is (it has no app id, and its
 * body id repeats in every account that claimed one, so an app id lookup
 * across accounts would answer with somebody else's).
 */
export async function shelfRowOf(
  ctx: QueryCtx | MutationCtx,
  ownerId: Id<'users'>,
  table: 'pilots' | 'mechs',
  id: string
): Promise<Doc<'pilots'> | Doc<'mechs'> | null> {
  const stamped = (await oldestByAppId(ctx, table, id)) as Doc<'pilots'> | Doc<'mechs'> | null
  if (stamped !== null && stamped.ownerId === ownerId && stamped.gameId === null) return stamped
  const shelf = (await ctx.db
    .query(table)
    .withIndex('by_owner_game', (q) => q.eq('ownerId', ownerId).eq('gameId', null))
    .collect()) as Array<Doc<'pilots'> | Doc<'mechs'>>
  return shelf.find((row) => linkIdOf(row) === id) ?? null
}

/**
 * Refuse a solo write to a pilot or mech that is not on the caller's shelf,
 * saying why: another player's (in `assertMayWrite`'s words), one of theirs in
 * a Game, or nothing of theirs at all.
 */
async function refuseOffShelf(
  ctx: MutationCtx,
  userId: Id<'users'>,
  type: 'pilot' | 'mech',
  id: string
): Promise<never> {
  const row = await resolveLinkEnd(ctx, { type, id }, null)
  if (row !== null && row.ownerId !== userId) {
    assertMayWrite(row as Doc<'pilots'> | Doc<'mechs'>, userId)
  }
  if (row !== null && row.gameId !== null) {
    throw new NotAuthorized(`That ${type} is in a Game: it plays there`)
  }
  throw new NotAuthorized(`That ${type} is not on your shelf`)
}

/**
 * A pilot whose seat the caller may write, and where that seat sits; or a
 * refusal. `gameId` null addresses the pilot's solo seat.
 *
 * In a Game, membership is checked first, so a non-member learns nothing about
 * what the Game holds, and the pilot is addressed the way a link end is
 * (`resolveLinkEnd`), which also finds a template-seeded pilot by its body id.
 */
export async function writablePilot(
  ctx: MutationCtx,
  gameId: Id<'games'> | null,
  pilotId: string
): Promise<{ userId: Id<'users'>; pilot: Doc<'pilots'>; place: SeatPlace }> {
  const userId = await requireUser(ctx)
  if (gameId === null) {
    const pilot = await shelfRowOf(ctx, userId, 'pilots', pilotId)
    if (pilot === null) return await refuseOffShelf(ctx, userId, 'pilot', pilotId)
    return { userId, pilot: pilot as Doc<'pilots'>, place: { ownerId: userId } }
  }

  await requireMember(ctx, gameId)
  const row = await resolveLinkEnd(ctx, { type: 'pilot', id: pilotId }, gameId)
  if (row === null || row.gameId !== gameId) {
    throw new NotAuthorized('That pilot is not in this Game')
  }
  // A `pilot` end only ever resolves to a row of the `pilots` table.
  const pilot = row as Doc<'pilots'>
  assertMayWrite(pilot, userId)
  return { userId, pilot, place: { gameId } }
}

/**
 * The mech a seat at `place` may board, and the id seats name it by; or a
 * refusal.
 *
 * Boarding needs write access to the mech, because playing a mech writes its
 * Heat, EP and SP; it must be where the seat is (the Game, or the caller's
 * shelf), not destroyed, and nobody else at that place may be aboard it.
 * Boarding never assigns: the pilot's `mech-to-pilot` link is untouched.
 */
async function boardableMech(
  ctx: MutationCtx,
  userId: Id<'users'>,
  place: SeatPlace,
  pilotId: string,
  mechId: string
): Promise<string> {
  let mech: Doc<'mechs'>
  if ('gameId' in place) {
    const row = await resolveLinkEnd(ctx, { type: 'mech', id: mechId }, place.gameId)
    if (row === null || row.gameId !== place.gameId) {
      throw new NotAuthorized('That mech is not in this Game')
    }
    // A `mech` end only ever resolves to a row of the `mechs` table.
    mech = row as Doc<'mechs'>
    assertMayWrite(mech, userId)
  } else {
    const row = await shelfRowOf(ctx, userId, 'mechs', mechId)
    if (row === null) return await refuseOffShelf(ctx, userId, 'mech', mechId)
    mech = row as Doc<'mechs'>
  }
  if ((mech.body as { destroyed?: unknown }).destroyed === true) {
    throw new NotAuthorized('That mech is destroyed')
  }

  const id = linkIdOf(mech) ?? mechId
  for (const seat of await seatsAt(ctx, place)) {
    if (seat.pilotId === pilotId) continue
    if (seat.mount.kind === 'boarded' && seat.mount.mechId === id) {
      throw new NotAuthorized('Another pilot is already aboard that mech')
    }
  }
  return id
}

/** Which seat a write addresses: a Game's, or (`gameId` null) the pilot's solo seat. */
const SEAT_ARGS = { gameId: v.union(v.id('games'), v.null()), pilotId: v.string() }

/** One pilot's seat as `forGame` returns it: `null`, not absent, for "none yet". */
type SeatRead = Omit<SeatState, 'resolving' | 'ejected'> & {
  pilotId: string
  resolving: NonNullable<SeatState['resolving']> | null
  updatedAt: number | null
}

/** A seat as `forGame` returns it, and `solo` with its solo fields. */
const seatRead = v.object({
  pilotId: v.string(),
  mount: seatMount,
  range: seatRange,
  activeEffects: v.array(v.string()),
  resolving: v.union(seatResolving, v.null()),
  updatedAt: v.union(v.number(), v.null()),
})

/**
 * Every pilot's seat in the Game, one entry per pilot in it.
 *
 * A pilot with no row yet gets the default seat, so every caller sees the same
 * answer for "never sat down" without inventing it. Rows for pilots no longer
 * in the Game are not returned; the cleanup paths delete them anyway.
 */
export const forGame = query({
  args: { gameId: v.id('games') },
  returns: v.array(seatRead),
  handler: async (ctx, args) => {
    if ((await membershipOrNull(ctx, args.gameId)) === null) return []
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

/** A solo seat as `solo` returns it. */
type SoloSeatRead = SeatRead & {
  ejected: boolean
  downtime: NonNullable<Doc<'seats'>['downtime']> | null
}

/**
 * One pilot's solo seat, for its owner: the default seat when it has no row
 * yet, and null when the pilot is not on the caller's shelf (somebody else's,
 * in a Game, or gone), so a screen whose pilot just moved into a Game reads
 * "not solo" rather than an error.
 *
 * `downtime` is the solo Downtime, null while none runs (`downtime.ts`).
 *
 * A seat whose row is boarded in a mech that is not on the caller's shelf
 * reads as on foot: the mech moved into a Game ahead of its pilot (it waits
 * there for `handOffSoloSeat`), or is gone. The solo screen never plays a mech
 * off its shelf, which a Game seat may be boarding at the same time.
 */
export const solo = query({
  args: { pilotId: v.string() },
  returns: v.union(
    seatRead.extend({ ejected: v.boolean(), downtime: v.union(soloDowntime, v.null()) }),
    v.null()
  ),
  handler: async (ctx, args): Promise<SoloSeatRead | null> => {
    const userId = await requireUser(ctx)
    if ((await shelfRowOf(ctx, userId, 'pilots', args.pilotId)) === null) return null
    const row = await readSeat(ctx, { ownerId: userId }, args.pilotId)
    if (row === null) {
      return {
        pilotId: args.pilotId,
        ...defaultSeat(),
        resolving: null,
        ejected: false,
        downtime: null,
        updatedAt: null,
      }
    }
    const offShelf =
      row.mount.kind === 'boarded' &&
      (await shelfRowOf(ctx, userId, 'mechs', row.mount.mechId)) === null
    return {
      pilotId: args.pilotId,
      mount: offShelf ? { kind: 'foot' as const } : row.mount,
      range: row.range,
      activeEffects: row.activeEffects,
      // A resolve belongs to the mount it began on.
      resolving: offShelf ? null : (row.resolving ?? null),
      ejected: row.ejected === true,
      downtime: row.downtime ?? null,
      updatedAt: row.updatedAt,
    }
  },
})

/**
 * Board a mech.
 *
 * Refused unless the caller may write both the pilot and the mech, the mech is
 * where the seat is (in this Game, or on the caller's shelf for a solo seat)
 * and not destroyed, and no other seat there is boarded in it. Boarding a mech
 * the pilot is already in is a no-op that still succeeds.
 */
export const board = mutation({
  args: { ...SEAT_ARGS, mechId: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const { userId, place } = await writablePilot(ctx, args.gameId, args.pilotId)
    const mechId = await boardableMech(ctx, userId, place, args.pilotId, args.mechId)
    await writeSeat(ctx, place, args.pilotId, (seat) => ({
      ...remount(seat, { kind: 'boarded', mechId }),
      ejected: undefined,
    }))
  },
})

/** Climb out of the mech, back on foot. */
export const dismount = mutation({
  args: SEAT_ARGS,
  handler: async (ctx, args): Promise<void> => {
    const { place } = await writablePilot(ctx, args.gameId, args.pilotId)
    await writeSeat(ctx, place, args.pilotId, (seat) => ({
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
 * it in Play (ADR-007), and nothing ever ejects a pilot for them.
 */
export const eject = mutation({
  args: SEAT_ARGS,
  handler: async (ctx, args): Promise<void> => {
    const { place } = await writablePilot(ctx, args.gameId, args.pilotId)
    await writeSeat(ctx, place, args.pilotId, (seat) => ({
      ...remount(seat, { kind: 'foot' }),
      ejected: true,
    }))
  },
})

/** Declare the engagement range band. */
export const setRange = mutation({
  args: { ...SEAT_ARGS, range: seatRange },
  handler: async (ctx, args): Promise<void> => {
    const { place } = await writablePilot(ctx, args.gameId, args.pilotId)
    await writeSeat(ctx, place, args.pilotId, () => ({ range: args.range }))
  },
})

/**
 * Switch an activated effect on or off, by the ref of the record that declares
 * it (ADR-029 §4). Expiry is manual: the table keeps time, the app keeps state.
 */
export const toggleEffect = mutation({
  args: { ...SEAT_ARGS, ref: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const { place } = await writablePilot(ctx, args.gameId, args.pilotId)
    await writeSeat(ctx, place, args.pilotId, (seat) => ({
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
    const { place } = await writablePilot(ctx, args.gameId, args.pilotId)
    await writeSeat(ctx, place, args.pilotId, () => ({ resolving: args.resolving }))
  },
})

/** The resolve is over: back to the deck. */
export const clearResolving = mutation({
  args: SEAT_ARGS,
  handler: async (ctx, args): Promise<void> => {
    const { place } = await writablePilot(ctx, args.gameId, args.pilotId)
    await writeSeat(ctx, place, args.pilotId, () => ({ resolving: undefined }))
  },
})
