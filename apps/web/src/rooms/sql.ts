/**
 * The slice of SQLite a room uses, so its logic is plain TypeScript: Durable
 * Object storage in the Worker (`../worker/rooms.ts`), `bun:sqlite` in tests.
 */

export type SqlValue = string | number | null

export type SqlRow = Record<string, SqlValue>

export type RoomSql = {
  /** Runs one statement and answers its rows. */
  exec<Row extends SqlRow = SqlRow>(query: string, ...bindings: SqlValue[]): Row[]
  /** Runs `fn` atomically: all of its writes, or none when it throws. */
  transaction<T>(fn: () => T): T
}
