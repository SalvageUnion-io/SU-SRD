import { describe, expect, test } from 'bun:test'
import { dumpRoom, isEmptyDump, loadRoom } from '../dump'
import { migrate } from '../migrate'
import { bunSql } from './bunSql'

const STEPS = [
  ['create table units (id text primary key, body text not null, seq integer not null)'],
  ['create table "odd ""name""" (k text)'],
]

function room() {
  const sql = bunSql()
  migrate(sql, STEPS)
  return sql
}

describe('room dumps', () => {
  test('a dump holds every room table and leaves the schema marker out', () => {
    const sql = room()
    sql.exec("insert into units values ('u1', '{\"hp\":3}', 4)")
    sql.exec('insert into "odd ""name""" values (?)', 'x')
    expect(dumpRoom(sql, 2)).toEqual({
      format: 1,
      schema: 2,
      tables: { 'odd "name"': [{ k: 'x' }], units: [{ id: 'u1', body: '{"hp":3}', seq: 4 }] },
    })
  })

  test('loading a dump replaces what the room held', () => {
    const from = room()
    from.exec("insert into units values ('u1', 'a', 1)")
    const dump = dumpRoom(from, 2)
    const to = room()
    to.exec("insert into units values ('u2', 'b', 9)")
    loadRoom(to, 2, dump)
    expect(to.exec('select * from units')).toEqual([{ id: 'u1', body: 'a', seq: 1 }])
    expect(to.exec('select version from room_schema')).toEqual([{ version: 2 }])
  })

  test('a dump from another schema is refused and changes nothing', () => {
    const sql = room()
    sql.exec("insert into units values ('u2', 'b', 9)")
    expect(() => loadRoom(sql, 2, { format: 1, schema: 1, tables: { units: [] } })).toThrow(
      'schema 1'
    )
    expect(() => loadRoom(sql, 2, { format: 1, schema: 2, tables: { gone: [] } })).toThrow(
      'unknown tables: gone'
    )
    expect(sql.exec('select id from units')).toEqual([{ id: 'u2' }])
  })

  test('a load that fails part-way leaves the room as it was', () => {
    const sql = room()
    sql.exec("insert into units values ('u2', 'b', 9)")
    const bad = {
      format: 1 as const,
      schema: 2,
      tables: { units: [{ id: 'u1', body: null, seq: 1 }] },
    }
    expect(() => loadRoom(sql, 2, bad)).toThrow()
    expect(sql.exec('select id from units')).toEqual([{ id: 'u2' }])
  })

  test('an unused room dumps empty', () => {
    expect(isEmptyDump(dumpRoom(room(), 2))).toBe(true)
  })
})
