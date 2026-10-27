/**
 * Games as the other rooms see them: a Game's name and Mediator, who
 * is in it, and its invite code. Each Game room writes its own rows when they
 * change (`roomRows.ts`); an account room lists its Games from here, and an
 * invite link is looked up here before any room is woken.
 */

import type { InvitePreviewAnswer } from '../../lib/linkPreview/previewSummary'
import type { SharedDb } from './db'

/** One member's place in a Game. */
export type MembershipRow = {
  gameId: string
  discordId: string
  mediator: boolean
  organizer: boolean
}

/** A Game the account belongs to, as its lists draw it. */
export type MemberGame = { gameId: string; name: string; mediator: boolean; organizer: boolean }

type MemberGameColumns = { game_id: string; name: string; mediator: number; organizer: number }

/** Every Game an account belongs to, by name. */
export async function gamesOf(db: SharedDb, discordId: string): Promise<MemberGame[]> {
  const { results } = await db
    .prepare(
      `select g.game_id, g.name, m.mediator, m.organizer from memberships m
       join games g on g.game_id = m.game_id
       where m.discord_id = ?1 order by g.name`
    )
    .bind(discordId)
    .all<MemberGameColumns>()
  return results.map((row) => ({
    gameId: row.game_id,
    name: row.name,
    mediator: row.mediator === 1,
    organizer: row.organizer === 1,
  }))
}

/** One member's place in one Game, or null when they are not in it. */
export async function membershipOf(
  db: SharedDb,
  gameId: string,
  discordId: string
): Promise<MembershipRow | null> {
  const row = await db
    .prepare('select mediator, organizer from memberships where game_id = ?1 and discord_id = ?2')
    .bind(gameId, discordId)
    .first<{ mediator: number; organizer: number }>()
  return row === null
    ? null
    : { gameId, discordId, mediator: row.mediator === 1, organizer: row.organizer === 1 }
}

/** The Game an invite code joins, or null for a code that is no Game's now. */
export async function gameOfInvite(db: SharedDb, code: string): Promise<string | null> {
  const row = await db
    .prepare('select game_id from invites where code = ?1')
    .bind(code)
    .first<{ game_id: string }>()
  return row?.game_id ?? null
}

/**
 * What an invite's link preview may say: the Game's name and who mediates,
 * never the code or the crew; null for a code that is no Game's now.
 */
export async function invitePreview(
  db: SharedDb,
  code: string
): Promise<InvitePreviewAnswer | null> {
  const row = await db
    .prepare(
      `select g.name, g.mediated_by from invites i join games g on g.game_id = i.game_id
       where i.code = ?1`
    )
    .bind(code)
    .first<{ name: string; mediated_by: string | null }>()
  return row === null ? null : { gameName: row.name, mediatedBy: row.mediated_by }
}
