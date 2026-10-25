import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { migrate } from '../migrate'
import { bunSql } from './bunSql'

const V1 = ['create table units (id text primary key)']
const V2 = ['alter table units add column name text', "insert into units values ('a', 'Mule')"]

describe('migrate', () => {
  test('a new room runs every step and records the version', () => {
    const sql = bunSql()
    expect(migrate(sql, [V1, V2])).toBe(2)
    expect(sql.exec('select * from units')).toEqual([{ id: 'a', name: 'Mule' }])
    expect(sql.exec('select version from room_schema')).toEqual([{ version: 2 }])
  })

  test('an open room runs only the steps it has not', () => {
    const sql = bunSql()
    migrate(sql, [V1])
    sql.exec("insert into units values ('b')")
    migrate(sql, [V1, V2])
    expect(sql.exec<{ id: string }>('select id from units order by id').map((r) => r.id)).toEqual([
      'a',
      'b',
    ])
    expect(migrate(sql, [V1, V2])).toBe(2)
  })

  test('a step that fails leaves the room at the step before it', () => {
    const db = new Database(':memory:', { strict: true })
    const sql = bunSql(db)
    expect(() =>
      migrate(sql, [V1, ['alter table units add column name text', 'not sql']])
    ).toThrow()
    expect(sql.exec('select version from room_schema')).toEqual([{ version: 1 }])
    expect(sql.exec("select name from pragma_table_info('units')")).toEqual([{ name: 'id' }])
  })

  test('a room newer than the build refuses to open', () => {
    const sql = bunSql()
    migrate(sql, [V1, V2])
    expect(() => migrate(sql, [V1])).toThrow("room schema 2 is newer than this build's 1")
  })

  test('no steps is version 0', () => {
    expect(migrate(bunSql(), [])).toBe(0)
  })
})
