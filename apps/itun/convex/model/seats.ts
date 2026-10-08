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
 * removes a whole Game calls `deleteGamePlayState`.
 */

/** The play state a seat holds, without its keys and timestamp. */
export type SeatState = Pick<Doc<'seats'>, 'mount' | 'range' | 'activeEffects'>

/** What a pilot with no seat row is: on foot, at Close range, nothing switched on. */
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
 * the table.
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
      await ctx.db.patch(seat._id, { mount: { kind: 'foot' }, updatedAt: Date.now() })
    }
  }
}

/**
 * Delete a Game's play state: its seats and its Downtime row.
 *
 * Both describe the table, not anything a person built, so they go with the
 * Game rather than falling back to a shelf. Neither `games.destroy` nor the
 * last-member path of `account.deleteAccount` swept the Downtime row before
 * seats existed; both call this now.
 */
export async function deleteGamePlayState(ctx: MutationCtx, gameId: Id<'games'>): Promise<void> {
  for (const seat of await seatsInGame(ctx, gameId)) await ctx.db.delete(seat._id)
  const downtime = await ctx.db
    .query('downtime')
    .withIndex('by_game', (q) => q.eq('gameId', gameId))
    .collect()
  for (const row of downtime) await ctx.db.delete(row._id)
}
