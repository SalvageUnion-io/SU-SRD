import { Database } from 'bun:sqlite'
import type { RoomSql, SqlRow, SqlValue } from '../sql'

/** A room's SQL over an in-memory `bun:sqlite` database, as Durable Object storage answers it. */
export function bunSql(db = new Database(':memory:', { strict: true })): RoomSql {
  return {
    exec: <Row extends SqlRow>(query: string, ...bindings: SqlValue[]) =>
      db.query(query).all(...bindings) as Row[],
    transaction: (fn) => db.transaction(fn)(),
  }
}
