/**
 * Accounts as the sign-in keeps them (`accounts`, created by the Worker's
 * sign-in on first use): read here by Discord id, for the bot.
 */

import type { SharedDb } from './db'

/** The account a Discord user signs in with, as the bot shows it. */
export type DiscordAccount = {
  account_id: string
  display_name: string | null
  name: string | null
  avatar_url: string | null
}

/** The account signed in with Discord user `discordId`, or null for none. */
export function accountByDiscordId(
  db: SharedDb,
  discordId: string
): Promise<DiscordAccount | null> {
  return db
    .prepare(
      'select account_id, display_name, name, avatar_url from accounts where discord_id = ?1'
    )
    .bind(discordId)
    .first<DiscordAccount>()
}

/** The profile sign-in keeps for account `accountId`: Discord's name and avatar, and the email. */
export function signInProfile(
  db: SharedDb,
  accountId: string
): Promise<{ name: string | null; avatar_url: string | null; email: string | null } | null> {
  return db
    .prepare('select name, avatar_url, email from accounts where account_id = ?1')
    .bind(accountId)
    .first()
}

/** What a player's account export carries from here: their Homebrew reports and their Games. */
export async function exportedRows(db: SharedDb, discordId: string) {
  const [reports, games] = await Promise.all([
    db
      .prepare('select reason, at from homebrew_reports where reporter_id = ?1 order by at')
      .bind(discordId)
      .all<{ reason: string; at: number }>(),
    db
      .prepare('select game_id, mediator, organizer from memberships where discord_id = ?1')
      .bind(discordId)
      .all<{ game_id: string; mediator: number; organizer: number }>(),
  ])
  return {
    homebrewReports: reports.results,
    games: games.results.map((g) => ({
      gameId: g.game_id,
      mediator: g.mediator === 1,
      organizer: g.organizer === 1,
    })),
  }
}
