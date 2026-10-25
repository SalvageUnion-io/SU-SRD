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
