/**
 * Accounts as the sign-in keeps them (`accounts`, `migrations/0007_sign_in.sql`):
 * read here by Discord id, for the bot, and by account id for the profile
 * Discord gives a player.
 */

import type { Profile } from '../../rooms/account/shelf'
import type { SharedDb } from './db'
import { playerGameIds } from './games'

/** The account a Discord user signs in with: Discord's name and avatar. */
export type DiscordAccount = {
  account_id: string
  name: string | null
  avatar_url: string | null
}

/**
 * The name and avatar a player shows everywhere (their `me`, each Game's
 * roster, the bot): their own (`AccountRoom.profile`) where they set one, else
 * Discord's.
 */
export function shownProfile(
  own: Profile | null,
  discord: Pick<DiscordAccount, 'name' | 'avatar_url'> | null
): Profile {
  return {
    displayName: own?.displayName ?? discord?.name ?? null,
    avatarUrl: own?.avatarUrl ?? discord?.avatar_url ?? null,
  }
}

/** The account signed in with Discord user `discordId`, or null for none. */
export function accountByDiscordId(
  db: SharedDb,
  discordId: string
): Promise<DiscordAccount | null> {
  return db
    .prepare('select account_id, name, avatar_url from accounts where discord_id = ?1')
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

/**
 * What a player's account export carries from here: their Homebrew reports
 * and their Games, every one deletion would reach (`playerGameIds`), with the
 * roles the shared database knows.
 */
export async function exportedRows(db: SharedDb, discordId: string, noted: readonly string[]) {
  const [reports, roles, gameIds] = await Promise.all([
    db
      .prepare('select reason, at from homebrew_reports where reporter_id = ?1 order by at')
      .bind(discordId)
      .all<{ reason: string; at: number }>(),
    db
      .prepare('select game_id, mediator, organizer from memberships where discord_id = ?1')
      .bind(discordId)
      .all<{ game_id: string; mediator: number; organizer: number }>(),
    playerGameIds(db, discordId, noted),
  ])
  const roleOf = new Map(roles.results.map((g) => [g.game_id, g]))
  return {
    homebrewReports: reports.results,
    games: gameIds.map((gameId) => ({
      gameId,
      mediator: roleOf.get(gameId)?.mediator === 1,
      organizer: roleOf.get(gameId)?.organizer === 1,
    })),
  }
}
