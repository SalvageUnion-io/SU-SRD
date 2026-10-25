import type { RoomSql } from './sql'

/** A room's schema: step N (from 1) is the statements that take it from N-1 to N. */
export type Migrations = readonly (readonly string[])[]

/**
 * Brings a room's storage up to `steps`, each step in its own transaction,
 * and answers the version it is at. A room whose stored version is newer than
 * the code (a rollback past a migration) refuses to open rather than write
 * under a schema it does not know.
 */
export function migrate(sql: RoomSql, steps: Migrations): number {
  sql.exec('create table if not exists room_schema (version integer not null)')
  const from = sql.exec<{ version: number }>('select version from room_schema')[0]?.version ?? 0
  if (from > steps.length) {
    throw new Error(`room schema ${from} is newer than this build's ${steps.length}`)
  }
  for (const [index, statements] of steps.entries()) {
    if (index < from) continue
    sql.transaction(() => {
      for (const statement of statements) sql.exec(statement)
      sql.exec('delete from room_schema')
      sql.exec('insert into room_schema (version) values (?)', index + 1)
    })
  }
  return steps.length
}
