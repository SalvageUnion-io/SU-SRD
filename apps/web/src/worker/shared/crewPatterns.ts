/**
 * Patterns shared with a Game's crew (ADR-032 §7), in the shared database:
 * the maker's account room writes them (`roomRows.ts`), and a crewmate reads
 * those of the Games they are in. A pattern lives in one account room, so this
 * is how the rest of a crew sees it.
 */

import type { SharedDb } from './db'
import { parseJson } from './db'

/** One pattern a crewmate shared, as the patterns page's "My Game's crew" draws it. */
export type CrewPattern = {
  appId: string
  body: unknown
  madeBy: string
  gameId: string
  gameName: string
}

type CrewColumns = {
  app_id: string
  body: string
  made_by: string
  game_id: string
  game_name: string
}

/** Every pattern shared with a Game the reader is in, but their own: those are on their Shelf. */
export async function crewPatternsFor(db: SharedDb, discordId: string): Promise<CrewPattern[]> {
  const { results } = await db
    .prepare(
      `select c.app_id, c.body, c.made_by, c.game_id, g.name as game_name from crew_patterns c
       join memberships m on m.game_id = c.game_id and m.discord_id = ?1
       join games g on g.game_id = c.game_id
       where c.owner_id != ?1
       order by g.name, c.shared_at desc`
    )
    .bind(discordId)
    .all<CrewColumns>()
  return results.flatMap((row) => {
    const body = parseJson<unknown>(row.body)
    return body === null
      ? []
      : [
          {
            appId: row.app_id,
            body,
            madeBy: row.made_by,
            gameId: row.game_id,
            gameName: row.game_name,
          },
        ]
  })
}

/** The patterns crewmates shared with one Game the reader is in, but their own; none if not in it. */
export async function gamePatternsFor(
  db: SharedDb,
  gameId: string,
  discordId: string
): Promise<CrewPattern[]> {
  return (await crewPatternsFor(db, discordId)).filter((row) => row.gameId === gameId)
}

/** A Game's name, when the reader is in it; null otherwise: what sharing a pattern with it needs. */
export async function memberGameName(
  db: SharedDb,
  gameId: string,
  discordId: string
): Promise<string | null> {
  const row = await db
    .prepare(
      `select g.name from memberships m join games g on g.game_id = m.game_id
       where m.game_id = ?1 and m.discord_id = ?2`
    )
    .bind(gameId, discordId)
    .first<{ name: string }>()
  return row?.name ?? null
}
