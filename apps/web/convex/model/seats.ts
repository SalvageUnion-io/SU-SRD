import type { OwnableKind } from 'game-domain/entityKinds'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { ContainedRow } from './entities'
import { linkIdOf, resolveLinkEnd } from './entities'

/**
 * Seat helpers shared by `seats.ts`, `downtime.ts` and every path that would
 * otherwise orphan a seat ([ADR-038](../../../../docs/adr/038-dashboard-game-surface.md) §2).
 *
 * A seat is keyed on a pilot's app id at one place, a Game's table or its
 * owner's shelf (`SeatPlace`), and points at its boarded mech by app id, the
 * way soft-link ends do. Neither end is a foreign key, so nothing in the
 * database notices when the pilot or the mech goes away. Every path that
 * removes one from a container calls `releaseSeatsOf`, every path that removes
 * a whole Game calls `deleteGameApparatus`, and a pilot moved from the shelf
 * into a Game takes its solo seat along (`handOffSoloSeat`).
 */

/**
 * Where a seat sits: at a Game's table, or solo on one owner's shelf. A solo
 * seat is keyed on its owner as well as its pilot because a template pre-gen's
 * body id (`linkIdOf`) repeats in every account that claimed one.
 */
export type SeatPlace = { gameId: Id<'games'> } | { ownerId: Id<'users'> }

/** The play state a seat holds, without its keys, timestamps and solo Downtime. */
export type SeatState = Pick<
  Doc<'seats'>,
  'mount' | 'range' | 'activeEffects' | 'resolving' | 'ejected'
>

/** Everything a seat write may change: its play state and, solo, its Downtime. */
export type SeatChange = Partial<SeatState & Pick<Doc<'seats'>, 'downtime'>>

/**
 * What a pilot with no seat row is: on foot, at Close range, nothing switched
 * on, and resolving nothing.
 */
export function defaultSeat(): SeatState {
  return { mount: { kind: 'foot' }, range: 'Close', activeEffects: [] }
}

/** One pilot's seat row at a place, or null when it has none yet. */
export async function readSeat(
  ctx: QueryCtx | MutationCtx,
  place: SeatPlace,
  pilotId: string
): Promise<Doc<'seats'> | null> {
  if ('gameId' in place) {
    return await ctx.db
      .query('seats')
      .withIndex('by_game_pilot', (q) => q.eq('gameId', place.gameId).eq('pilotId', pilotId))
      .unique()
  }
  return await ctx.db
    .query('seats')
    .withIndex('by_owner_pilot', (q) => q.eq('ownerId', place.ownerId).eq('pilotId', pilotId))
    .unique()
}

/** Every seat row in a Game: `gameId` is a prefix of `by_game_pilot`. */
export async function seatsInGame(
  ctx: QueryCtx | MutationCtx,
  gameId: Id<'games'>
): Promise<Doc<'seats'>[]> {
  return await ctx.db
    .query('seats')
    .withIndex('by_game_pilot', (q) => q.eq('gameId', gameId))
    .collect()
}

/** Every solo seat on one owner's shelf: `ownerId` is a prefix of `by_owner_pilot`. */
export async function soloSeatsOf(
  ctx: QueryCtx | MutationCtx,
  ownerId: Id<'users'>
): Promise<Doc<'seats'>[]> {
  return await ctx.db
    .query('seats')
    .withIndex('by_owner_pilot', (q) => q.eq('ownerId', ownerId))
    .collect()
}

/** Every seat at one place. */
export async function seatsAt(
  ctx: QueryCtx | MutationCtx,
  place: SeatPlace
): Promise<Doc<'seats'>[]> {
  return 'gameId' in place
    ? await seatsInGame(ctx, place.gameId)
    : await soloSeatsOf(ctx, place.ownerId)
}

/** Write part of a seat, creating its row on first use. */
export async function writeSeat(
  ctx: MutationCtx,
  place: SeatPlace,
  pilotId: string,
  change: (seat: Doc<'seats'> | (SeatState & { downtime?: undefined })) => SeatChange
): Promise<void> {
  const existing = await readSeat(ctx, place, pilotId)
  const updatedAt = Date.now()
  if (existing !== null) {
    await ctx.db.patch(existing._id, { ...change(existing), updatedAt })
    return
  }
  const seat = defaultSeat()
  await ctx.db.insert('seats', { ...place, pilotId, ...seat, ...change(seat), updatedAt })
}

/** Move to `mount`, dropping the resolve in progress if the mount changed. */
export function remount(seat: SeatState, mount: SeatState['mount']): Partial<SeatState> {
  const same =
    seat.mount.kind === mount.kind &&
    (mount.kind === 'foot' || (seat.mount.kind === 'boarded' && seat.mount.mechId === mount.mechId))
  return same ? { mount } : { mount, resolving: undefined }
}

/**
 * A pilot or mech has left a container, by deletion or by a move: `gameId`
 * names the Game it left, or is null for its owner's shelf.
 *
 * A pilot takes its seat with it: the seat describes play there, and a pilot
 * that comes back starts on foot like any other. (Moved from the shelf into a
 * Game, `handOffSoloSeat` has already carried the solo seat over.)
 *
 * A mech leaves its boarder standing: the seat stays, back on foot, because
 * the pilot is still at the table. Whatever it was resolving goes with the
 * mech, as it does on any change of mount. The one exception is a mech
 * **moved** off the shelf (`moved`): its solo boarder stays aboard, so that the
 * pilot following it into the same Game keeps its mount (`handOffSoloSeat`).
 * Until then the solo seat's row names a mech that is in the Game, which the
 * solo read (`seats.solo`) reports as on foot: the solo screen never plays a
 * mech off its shelf. Once that mech leaves the Game (deleted, or moved to
 * another Game) it cannot be followed in, so the solo seat stands up too.
 */
export async function releaseSeatsOf(
  ctx: MutationCtx,
  kind: OwnableKind,
  row: ContainedRow,
  gameId: Id<'games'> | null,
  { moved = false }: { moved?: boolean } = {}
): Promise<void> {
  const id = linkIdOf(row)
  if (id === undefined) return
  let place: SeatPlace
  if (gameId !== null) place = { gameId }
  else if (row.ownerId !== null) place = { ownerId: row.ownerId }
  else return

  if (kind === 'pilot') {
    const seat = await readSeat(ctx, place, id)
    if (seat !== null) await ctx.db.delete(seat._id)
    return
  }
  if (moved && 'ownerId' in place) return
  // A mech gone from a Game (deleted, or moved to another Game) can no longer
  // be followed in: a solo boarder its move left aboard stands up too.
  if ('gameId' in place && row.gameId !== null && row.ownerId !== null) {
    await standUp(ctx, await soloSeatsOf(ctx, row.ownerId), id)
  }
  await standUp(ctx, await seatsAt(ctx, place), id)
}

/** Every seat of `seats` boarded in mech `mechId`, back on foot. */
async function standUp(ctx: MutationCtx, seats: Doc<'seats'>[], mechId: string): Promise<void> {
  for (const seat of seats) {
    if (seat.mount.kind === 'boarded' && seat.mount.mechId === mechId) {
      await ctx.db.patch(seat._id, {
        mount: { kind: 'foot' },
        resolving: undefined,
        updatedAt: Date.now(),
      })
    }
  }
}

/**
 * A pilot has moved from its owner's shelf into `gameId`: its solo seat
 * becomes its seat there.
 *
 * Range, switched-on effects and the eject flag carry over. The mount carries
 * over only when the boarded mech is already in the Game, still its owner's,
 * not destroyed, and nobody there is aboard it, the same test boarding there
 * would make; otherwise the pilot sits down on foot. The resolve in progress
 * does not carry (the deck it came from belongs to the shelf), nor does solo
 * Downtime: in a Game, Downtime is the Game's (`downtime` table). Presence
 * carries, since the same screen is still open.
 *
 * Call it after the pilot row has moved and before `releaseSeatsOf` runs for
 * the shelf, which would otherwise delete the solo seat first.
 */
export async function handOffSoloSeat(
  ctx: MutationCtx,
  pilot: Doc<'pilots'>,
  gameId: Id<'games'>
): Promise<void> {
  const pilotId = linkIdOf(pilot)
  if (pilotId === undefined || pilot.ownerId === null) return
  const solo = await readSeat(ctx, { ownerId: pilot.ownerId }, pilotId)
  if (solo === null) return
  await ctx.db.delete(solo._id)

  let mount: SeatState['mount'] = { kind: 'foot' }
  if (solo.mount.kind === 'boarded') {
    const mechId = solo.mount.mechId
    const mech = await resolveLinkEnd(ctx, { type: 'mech', id: mechId }, gameId)
    const seats = await seatsInGame(ctx, gameId)
    const aboard = seats.some(
      (s) => s.pilotId !== pilotId && s.mount.kind === 'boarded' && s.mount.mechId === mechId
    )
    const destroyed = (mech?.body as { destroyed?: unknown } | undefined)?.destroyed === true
    if (mech !== null && mech.gameId === gameId && mech.ownerId === pilot.ownerId) {
      if (!aboard && !destroyed) mount = solo.mount
    }
  }

  const state = {
    mount,
    range: solo.range,
    activeEffects: solo.activeEffects,
    ejected: mount.kind === 'foot' ? solo.ejected : undefined,
    lastSeenAt: solo.lastSeenAt,
    updatedAt: Date.now(),
  }
  const existing = await readSeat(ctx, { gameId }, pilotId)
  if (existing !== null) {
    await ctx.db.patch(existing._id, { ...state, resolving: undefined })
    return
  }
  await ctx.db.insert('seats', { gameId, pilotId, ...state })
}

/**
 * Every table holding a Game's own apparatus: rows that describe the table
 * rather than anything a person built on it.
 *
 * Each one goes with the Game. `softLinks` are the table's wiring (a
 * pilot-to-crawler assignment stops being true when the crew disbands, so
 * shelved entities land unwired); `invites`, `inviteRedemptions` and
 * `joinRequests` are ways into a Game that no longer exists; its
 * `channelBindings` row stops naming a channel it posts to (a personal binding
 * has no `gameId` and outlives every Game); `downtime` and `seats` are its play
 * state (ADR-038 §2).
 *
 * Every other table with a `gameId` column holds something somebody built, or
 * history, and each teardown path shelves or deletes those rows itself first.
 * `test/convex/__tests__/gameTeardown.test.ts` fails when a table gains a `gameId` column
 * without being named here or exempted there.
 */
export const GAME_APPARATUS_TABLES = [
  'softLinks',
  'invites',
  'inviteRedemptions',
  'joinRequests',
  'memberships',
  'channelBindings',
  'downtime',
  'seats',
] as const

/**
 * Delete a Game: its apparatus (`GAME_APPARATUS_TABLES`), then the Game row.
 *
 * The one teardown for `games.destroy` and the last-member path of
 * `account.deleteAccount`. It runs after each has shelved or deleted the
 * Game's pilots, mechs, crawlers and encounter NPCs, which is why it is a
 * helper both call rather than something that fires on the Game's deletion.
 */
export async function deleteGameApparatus(ctx: MutationCtx, gameId: Id<'games'>): Promise<void> {
  for (const table of GAME_APPARATUS_TABLES) {
    const rows =
      table === 'seats'
        ? await seatsInGame(ctx, gameId)
        : await ctx.db
            .query(table)
            .withIndex('by_game', (q) => q.eq('gameId', gameId))
            .collect()
    for (const row of rows) await ctx.db.delete(row._id)
  }
  await ctx.db.delete(gameId)
}
