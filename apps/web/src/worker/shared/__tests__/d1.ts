import { Database } from 'bun:sqlite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Published, PublishedRoster } from '../../../rooms/publish'
import type { SharedDb, SharedStatement } from '../db'
import { RoomPublisher } from '../roomRows'

/**
 * The shared database for a test: `bun:sqlite` in memory, every migration in
 * `apps/web/migrations` applied in order, behind D1's statement API.
 */

const MIGRATIONS = join(import.meta.dir, '../../../../migrations')

type Binding = string | number | bigint | boolean | null | Uint8Array

type TestStatement = SharedStatement & { runNow(): unknown }

function statement(db: Database, sql: string, values: Binding[] = []): TestStatement {
  return {
    runNow: () => db.query(sql).run(...values),
    bind: (...next) => statement(db, sql, next as Binding[]),
    first: async <T>() => (db.query(sql).get(...values) as T | null) ?? null,
    all: async <T>() => ({ results: db.query(sql).all(...values) as T[] }),
    run: async () => db.query(sql).run(...values),
  }
}

export function testDb(): SharedDb & { sqlite: Database } {
  const sqlite = new Database(':memory:')
  for (const file of readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    sqlite.exec(readFileSync(join(MIGRATIONS, file), 'utf8'))
  }
  return {
    sqlite,
    prepare: (sql) => statement(sqlite, sql),
    batch: async (statements) => {
      // Synchronous, as D1 runs a batch: no other write lands inside it.
      const results: unknown[] = []
      sqlite.exec('BEGIN')
      try {
        for (const s of statements) results.push((s as TestStatement).runNow())
        sqlite.exec('COMMIT')
      } catch (error) {
        sqlite.exec('ROLLBACK')
        throw error
      }
      return results
    },
  }
}

/** Accounts as sign-in saves them: Discord's name and avatar, by Discord id. */
export function signedIn(
  db: SharedDb & { sqlite: Database },
  ...accounts: { accountId: string; discordId: string; name: string | null; avatarUrl?: string }[]
): void {
  for (const a of accounts) {
    db.sqlite
      .query(
        `insert into accounts (account_id, discord_id, name, avatar_url, created_at, updated_at)
         values (?, ?, ?, ?, 0, 0)`
      )
      .run(a.accountId, a.discordId, a.name, a.avatarUrl ?? null)
  }
}

/** `rows` written as room `room` writes them; a Shelf's Homebrew needs its `maker`. */
export function publish(
  db: SharedDb,
  room: string,
  rows: Partial<Published>,
  maker: string | null = null
) {
  return new RoomPublisher(db, room, maker, () => ({
    sheets: [],
    homebrew: [],
    ...rows,
  })).republish()
}

/** A Game's row, members and invite, as its room writes them. */
export function publishGame(
  db: SharedDb,
  gameId: string,
  game: Pick<NonNullable<PublishedRoster['game']>, 'name' | 'mediatedBy'> &
    Partial<NonNullable<PublishedRoster['game']>>
) {
  return publish(db, `game:${gameId}`, {
    roster: { gameId, game: { members: [], invite: null, ...game } },
  })
}
