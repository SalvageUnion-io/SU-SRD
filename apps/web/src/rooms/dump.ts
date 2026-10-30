/**
 * A room's whole storage as plain JSON, and back (ADR-064 decision 4): the
 * nightly backup writes one dump per room to R2 (`../worker/shared/backups.ts`),
 * and an admin's restore loads one into its room again.
 */

import type { RoomSql, SqlRow } from './sql'

/** Every row of every table a room keeps, at the schema it was taken at. */
export type RoomDump = {
  format: 1
  schema: number
  tables: Record<string, SqlRow[]>
}

/** The room's own tables: not SQLite's, not workerd's, not the schema marker `migrate` keeps. */
function roomTables(sql: RoomSql): string[] {
  return sql
    .exec<{ name: string }>(
      `select name from sqlite_master where type = 'table'
         and substr(name, 1, 7) <> 'sqlite_' and substr(name, 1, 4) <> '_cf_'
         and name <> 'room_schema'
       order by name`
    )
    .map((row) => row.name)
}

const quoted = (name: string): string => `"${name.replaceAll('"', '""')}"`

/** Whether the room keeps no rows at all: a name nobody has used yet. */
export function isEmptyDump(dump: RoomDump): boolean {
  return Object.values(dump.tables).every((rows) => rows.length === 0)
}

/** The room's storage now, at `schema`, in one read. */
export function dumpRoom(sql: RoomSql, schema: number): RoomDump {
  return sql.transaction(() => ({
    format: 1,
    schema,
    tables: Object.fromEntries(
      roomTables(sql).map((table) => [table, sql.exec(`select * from ${quoted(table)}`)])
    ),
  }))
}

/**
 * Replace the room's storage with `dump`, all of it or none. A dump from
 * another schema is refused, as is one naming a table this room does not
 * have: restoring across a migration is a code change, not a restore.
 */
export function loadRoom(sql: RoomSql, schema: number, dump: RoomDump): void {
  if (dump.format !== 1) throw new Error(`room dump format ${String(dump.format)} is not 1`)
  if (dump.schema !== schema) {
    throw new Error(`room dump is at schema ${dump.schema}, the room at ${schema}`)
  }
  const tables = roomTables(sql)
  const unknown = Object.keys(dump.tables).filter((table) => !tables.includes(table))
  if (unknown.length > 0) throw new Error(`room dump names unknown tables: ${unknown.join(', ')}`)
  sql.transaction(() => {
    for (const table of tables) {
      sql.exec(`delete from ${quoted(table)}`)
      for (const row of dump.tables[table] ?? []) {
        const columns = Object.keys(row)
        if (columns.length === 0) continue
        sql.exec(
          `insert into ${quoted(table)} (${columns.map(quoted).join(', ')}) values (${columns.map(() => '?').join(', ')})`,
          ...columns.map((column) => row[column] ?? null)
        )
      }
    }
  })
}
