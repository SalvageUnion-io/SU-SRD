/**
 * Account deletion on the rooms, by one rule: that **a campaign never dies because one person quit**.
 *
 *  1. Each Game they are in forgets them: their units go, the Organizer flag
 *     passes on, and a Game left with nobody ends (its channel binding too).
 *  2. Their account room is wiped: their Shelf, solo table and tray.
 *  3. What the shared database holds of theirs goes, in one batch: public
 *     sheets, Homebrew (and its reports and moderation), crew patterns,
 *     memberships, totals, their reports of others' patterns, their solo
 *     channel binding and their feedback.
 *
 * Each step can run again, so a retry after a refusal finishes the job. The
 * caller forgets the sign-in only once this answers `null`.
 */

import { RoomRefusal } from '../../rooms/refusal'
import type { Identity } from '../auth/index'
import type { GameRoomStub } from '../rooms'
import type { SharedDb } from './db'

/** The shared database and the rooms by name: `rooms().GameRoom` / `.AccountRoom.getByName`. */
export type AccountDeletionDeps = {
  db: SharedDb
  game(gameId: string): Pick<GameRoomStub, 'forget' | 'republish'>
  account(discordId: string): { forget(actor: string): Promise<void> }
}

/**
 * @public Delete the account `who` signs in: `null` once it is gone, or the 409
 * `{ errorMessage }` the app says when a step failed.
 */
export async function deleteRoomAccount(
  who: Pick<Identity, 'accountId' | 'discordId'>,
  deps: AccountDeletionDeps
): Promise<Response | null> {
  const { db } = deps
  const { discordId } = who
  try {
    const { results } = await db
      .prepare('select game_id from memberships where discord_id = ?1')
      .bind(discordId)
      .all<{ game_id: string }>()
    for (const { game_id: gameId } of results) {
      const room = deps.game(gameId)
      await room.forget(discordId)
      // The Game's rows follow now, so nothing below races its publish: a
      // Game that ended has dropped its own row, and its channel goes with it.
      await room.republish()
      await db
        .prepare(
          'delete from channel_bindings where game_id = ?1 and not exists (select 1 from games where game_id = ?1)'
        )
        .bind(gameId)
        .run()
    }

    await deps.account(discordId).forget(discordId)

    const theirPatterns = 'select app_id from homebrew_patterns where owner_id = ?1'
    await db.batch([
      db
        .prepare(
          `delete from homebrew_reports where reporter_id = ?1 or app_id in (${theirPatterns})`
        )
        .bind(discordId),
      db
        .prepare(`delete from homebrew_moderation where app_id in (${theirPatterns})`)
        .bind(discordId),
      db.prepare('delete from homebrew_patterns where owner_id = ?1').bind(discordId),
      db.prepare('delete from crew_patterns where owner_id = ?1').bind(discordId),
      db
        .prepare('delete from public_sheets where owner_id = ?1 or room = ?2')
        .bind(discordId, `account:${discordId}`),
      db.prepare('delete from memberships where discord_id = ?1').bind(discordId),
      db.prepare('delete from account_totals where discord_id = ?1').bind(discordId),
      db
        .prepare('delete from channel_bindings where game_id is null and bound_by = ?1')
        .bind(discordId),
      // `discord:` as the Worker and the bot write it; `user:` as Convex's site form did.
      db
        .prepare('delete from feedback where sender in (?1, ?2)')
        .bind(`discord:${discordId}`, `user:${who.accountId}`),
    ])
    return null
  } catch (error) {
    console.error('deleting an account failed', error)
    // A room's refusal is said as it is; anything else is not the player's to read.
    const errorMessage = error instanceof RoomRefusal ? error.message : 'unreachable'
    return Response.json({ errorMessage }, { status: 409 })
  }
}
