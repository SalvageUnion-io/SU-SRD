import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { ContainedRow } from './entities'
import { linkIdOf } from './entities'

/**
 * Seat helpers shared by `seats.ts` and every path that would otherwise orphan
 * a seat ([ADR-038](../../../../docs/ARCHITECTURE.md#adr-038) §2).
 *
 * A seat is keyed on a pilot's app id inside one Game and points at its boarded
 * mech by app id, the way soft-link ends do. Neither end is a foreign key, so
 * nothing in the database notices when the pilot or the mech goes away. Every
 * path that removes one from a Game calls `releaseSeatsOf`, and every path that
 * removes a whole Game calls `deleteGameApparatus`.
 */

/** The play state a seat holds, without its keys and timestamp. */
export type SeatState = Pick<
  Doc<'seats'>,
  'mount' | 'range' | 'activeEffects' | 'resolving' | 'ejected'
>

/**
 * What a pilot with no seat row is: on foot, at Close range, nothing switched
 * on, and resolving nothing.
 */
export function defaultSeat(): SeatState {
  return { mount: { kind: 'foot' }, range: 'Close', activeEffects: [] }
}

/** One pilot's seat row in a Game, or null when it has none yet. */
export async function readSeat(
  ctx: QueryCtx | MutationCtx,
  gameId: Id<'games'>,
  pilotId: string
): Promise<Doc<'seats'> | null> {
  return await ctx.db
    .query('seats')
    .withIndex('by_game_pilot', (q) => q.eq('gameId', gameId).eq('pilotId', pilotId))
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

/**
 * A pilot or mech has left `gameId`, by deletion or by a move.
 *
 * A pilot takes its seat with it: the seat describes play in that Game, and a
 * pilot that comes back starts on foot like any other. A mech leaves its
 * boarder standing: the seat stays, back on foot, because the pilot is still at
 * the table. Whatever it was resolving goes with the mech, as it does on any
 * change of mount.
 */
export async function releaseSeatsOf(
  ctx: MutationCtx,
  kind: 'pilot' | 'mech',
  row: ContainedRow,
  gameId: Id<'games'> | null
): Promise<void> {
  if (gameId === null) return
  const id = linkIdOf(row)
  if (id === undefined) return

  if (kind === 'pilot') {
    const seat = await readSeat(ctx, gameId, id)
    if (seat !== null) await ctx.db.delete(seat._id)
    return
  }
  for (const seat of await seatsInGame(ctx, gameId)) {
    if (seat.mount.kind === 'boarded' && seat.mount.mechId === id) {
      await ctx.db.patch(seat._id, {
        mount: { kind: 'foot' },
        resolving: undefined,
        updatedAt: Date.now(),
      })
    }
  }
}

/**
 * Every table holding a Game's own apparatus: rows that describe the table
 * rather than anything a person built on it.
 *
 * Each one goes with the Game. `softLinks` are the table's wiring (a
 * pilot-to-crawler assignment stops being true when the crew disbands, so
 * shelved entities land unwired); `invites`, `inviteRedemptions` and
 * `joinRequests` are ways into a Game that no longer exists, and an unanswered
 * knock at a deleted door would sit pending forever; a `channelBindings` row
 * claims a Discord channel for the Game, and a stale one refuses every later
 * bind of that channel; `downtime` and `seats` are its play state (ADR-038 §2).
 *
 * Every other table with a `gameId` column holds something somebody built, or
 * history, and each teardown path shelves or deletes those rows itself first.
 * `test/convex/gameTeardown.test.ts` fails when a table gains a `gameId` column
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
