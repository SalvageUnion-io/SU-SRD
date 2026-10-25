/**
 * Games as the other rooms see them: a Game's name and Mediator, who
 * is in it, and its invite code. Each Game room writes its own rows when they
 * change; an account room lists its Games from here, and an invite link is
 * looked up here before any room is woken.
 */

import type { InvitePreviewAnswer } from '../../lib/linkPreview/previewSummary'
import type { SharedDb } from './db'
import { flag } from './db'

/** A Game's row: its name and who runs the table. */
export type GameRow = {
  gameId: string
  name: string
  /** The Mediator's display name; null while the Game has none. */
  mediatedBy: string | null
}

/** One member's place in a Game. */
export type MembershipRow = {
  gameId: string
  accountId: string
  mediator: boolean
  organizer: boolean
}

/** A Game the account belongs to, as its lists draw it. */
export type MemberGame = { gameId: string; name: string; mediator: boolean; organizer: boolean }

/** Write a Game's row, or replace it: on a rename or a new Mediator. */
export async function putGame(db: SharedDb, game: GameRow, now = Date.now()) {
  await db
    .prepare(
      `insert into games (game_id, name, mediated_by, updated_at) values (?1, ?2, ?3, ?4)
       on conflict (game_id) do update set
         name = excluded.name, mediated_by = excluded.mediated_by, updated_at = excluded.updated_at`
    )
    .bind(game.gameId, game.name, game.mediatedBy, now)
    .run()
}

/** A Game is gone: its row, its members and its invite, all at once. */
export async function dropGame(db: SharedDb, gameId: string) {
  await db.batch([
    db.prepare('delete from invites where game_id = ?1').bind(gameId),
    db.prepare('delete from memberships where game_id = ?1').bind(gameId),
    db.prepare('delete from games where game_id = ?1').bind(gameId),
  ])
}

/** Write one member's place, or replace it: on joining, or a change of role. */
export async function putMembership(db: SharedDb, row: MembershipRow) {
  await db
    .prepare(
      `insert into memberships (game_id, account_id, mediator, organizer) values (?1, ?2, ?3, ?4)
       on conflict (game_id, account_id) do update set
         mediator = excluded.mediator, organizer = excluded.organizer`
    )
    .bind(row.gameId, row.accountId, flag(row.mediator), flag(row.organizer))
    .run()
}

/** A member left, or was removed. */
export async function dropMembership(db: SharedDb, gameId: string, accountId: string) {
  await db
    .prepare('delete from memberships where game_id = ?1 and account_id = ?2')
    .bind(gameId, accountId)
    .run()
}

type MemberGameColumns = { game_id: string; name: string; mediator: number; organizer: number }

/** Every Game an account belongs to, by name. */
export async function gamesOf(db: SharedDb, accountId: string): Promise<MemberGame[]> {
  const { results } = await db
    .prepare(
      `select g.game_id, g.name, m.mediator, m.organizer from memberships m
       join games g on g.game_id = m.game_id
       where m.account_id = ?1 order by g.name`
    )
    .bind(accountId)
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
  accountId: string
): Promise<MembershipRow | null> {
  const row = await db
    .prepare('select mediator, organizer from memberships where game_id = ?1 and account_id = ?2')
    .bind(gameId, accountId)
    .first<{ mediator: number; organizer: number }>()
  return row === null
    ? null
    : { gameId, accountId, mediator: row.mediator === 1, organizer: row.organizer === 1 }
}

/** A Game's invite code, new or reset: the old code stops working at once. */
export async function putInvite(db: SharedDb, gameId: string, code: string, now = Date.now()) {
  await db.batch([
    db.prepare('delete from invites where game_id = ?1').bind(gameId),
    db
      .prepare('insert into invites (code, game_id, created_at) values (?1, ?2, ?3)')
      .bind(code, gameId, now),
  ])
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
