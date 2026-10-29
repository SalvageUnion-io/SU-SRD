/**
 * The replica's rule for what it holds: a row stays while any scope's latest
 * snapshot has it, and a served row replaces the held one only when newer
 * (`replica.ts`).
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import { crawlerFixture, pilotFixture } from '../../components/__tests__/fixtures'
import {
  drop,
  gameScope,
  getView,
  headSeqOf,
  hold,
  resetReplica,
  restore,
  serve,
  setRowsComing,
  untilArrived,
} from '../replica'

const pilot = (id: string, name = `Pilot ${id}`) =>
  pilotFixture({ id, name, callsign: id, classRef: 'salvager' })
const crawler = (id: string, gameId: string | null) => ({
  ...crawlerFixture({ id, name: `Crawler ${id}`, techLevel: '1' }),
  gameId,
})
const link = (id: string, from: string, to: string) => ({
  id,
  type: 'pilot-to-crawler' as const,
  from: { type: 'pilot' as const, id: from },
  to: { type: 'crawler' as const, id: to },
  createdAt: '2026-10-25T00:00:00.000Z',
})

const ids = (rows: readonly { id: string }[]) => rows.map((r) => r.id).sort()

beforeEach(() => {
  resetReplica()
})

describe('a scope snapshot', () => {
  test('holds what it serves and marks its tables arrived', () => {
    serve('account', ['pilot'], [{ table: 'pilot', row: pilot('p1'), version: 1 }])
    expect(ids(getView().pilots)).toEqual(['p1'])
    expect(getView().hydrated.pilots).toBe(true)
    expect(getView().hydrated.mechs).toBe(false)
  })

  test('drops a row its next snapshot leaves out', () => {
    serve('account', ['pilot'], [{ table: 'pilot', row: pilot('p1'), version: 1 }])
    serve('account', ['pilot'], [])
    expect(getView().pilots).toEqual([])
  })

  test('keeps a row another scope still holds', () => {
    // A crawler two answers have.
    serve('account', ['crawler'], [{ table: 'crawler', row: crawler('c1', 'g1'), version: 1 }])
    serve(
      gameScope('g1'),
      ['crawler'],
      [{ table: 'crawler', row: crawler('c1', 'g1'), version: 1 }]
    )
    serve('account', ['crawler'], [])
    expect(ids(getView().crawlers)).toEqual(['c1'])
    serve(gameScope('g1'), ['crawler'], [])
    expect(getView().crawlers).toEqual([])
  })

  test('leaves the tables it does not speak for alone', () => {
    serve('account', ['pilot'], [{ table: 'pilot', row: pilot('p1'), version: 1 }])
    serve('account', ['mech'], [])
    expect(ids(getView().pilots)).toEqual(['p1'])
  })

  test('adopts a newer version and ignores an older one', () => {
    serve('account', ['pilot'], [{ table: 'pilot', row: pilot('p1', 'New'), version: 5 }])
    serve('account', ['pilot'], [{ table: 'pilot', row: pilot('p1', 'Old'), version: 3 }])
    expect(getView().pilots[0]?.name).toBe('New')
    serve('account', ['pilot'], [{ table: 'pilot', row: pilot('p1', 'Newer'), version: 6 }])
    expect(getView().pilots[0]?.name).toBe('Newer')
  })

  test('compares headSeq when both sides carry one', () => {
    serve('account', ['pilot'], [{ table: 'pilot', row: pilot('p1', 'A'), version: 9, headSeq: 4 }])
    serve('account', ['pilot'], [{ table: 'pilot', row: pilot('p1', 'B'), version: 1, headSeq: 5 }])
    expect(getView().pilots[0]?.name).toBe('B')
    expect(headSeqOf('pilot', 'p1')).toBe(5)
  })

  test('takes a unit moved into another room at the same headSeq, stamped later', () => {
    const at = (gameId: string | null, version: number) => ({
      table: 'pilot' as const,
      row: { ...pilot('p1', 'A'), gameId },
      version,
      headSeq: 4,
    })
    serve(gameScope('g1'), ['pilot'], [at('g1', 9)])
    serve('account', ['pilot'], [at(null, 12)])
    expect(getView().pilots[0]?.gameId).toBeNull()
    // The room it left, answering late, does not take it back.
    serve(gameScope('g1'), ['pilot'], [at('g1', 9)])
    expect(getView().pilots[0]?.gameId).toBeNull()
  })

  test('keeps the held copy of a row that no longer parses', () => {
    serve('account', ['pilot'], [{ table: 'pilot', row: pilot('p1', 'Good'), version: 1 }])
    serve('account', ['pilot'], [{ table: 'pilot', row: { id: 'p1', name: 7 }, version: 2 }])
    expect(getView().pilots[0]?.name).toBe('Good')
  })
})

describe('a write', () => {
  test('is held in the scope its row is served in, so the next snapshot judges it', () => {
    hold('pilot', pilot('p1'))
    serve('account', ['pilot'], [])
    expect(getView().pilots).toEqual([])

    hold('crawler', crawler('c1', 'g1'))
    serve('account', ['crawler'], [])
    expect(ids(getView().crawlers)).toEqual(['c1'])
    serve(gameScope('g1'), ['crawler'], [])
    expect(getView().crawlers).toEqual([])
  })

  test('is replaced by the next served version', () => {
    hold('pilot', pilot('p1', 'Mine'))
    serve('account', ['pilot'], [{ table: 'pilot', row: pilot('p1', 'Served'), version: 1 }])
    expect(getView().pilots[0]?.name).toBe('Served')
  })
})

describe('dropping an entity', () => {
  test('takes its links with it', () => {
    hold('pilot', pilot('p1'))
    hold('crawler', crawler('c1', null))
    hold('softLink', link('l1', 'p1', 'c1'))
    drop('pilot', 'p1')
    expect(getView().softLinks).toEqual([])
    expect(ids(getView().crawlers)).toEqual(['c1'])
  })
})

describe('a table view', () => {
  test('keeps its identity while another table changes', () => {
    hold('pilot', pilot('p1'))
    const pilots = getView().pilots
    hold('crawler', crawler('c1', null))
    expect(getView().pilots).toBe(pilots)
  })
})

describe('the device copy', () => {
  test('is put back without overriding a row a live answer brought', () => {
    serve('account', ['pilot'], [{ table: 'pilot', row: pilot('p1', 'Live'), version: 2 }])
    restore([
      {
        table: 'pilot',
        id: 'p1',
        row: pilot('p1', 'Kept'),
        version: 1,
        headSeq: undefined,
        scopes: ['account'],
      },
      {
        table: 'pilot',
        id: 'p2',
        row: pilot('p2'),
        version: 1,
        headSeq: undefined,
        scopes: ['account'],
      },
    ])
    expect(getView().pilots.find((p) => p.id === 'p1')?.name).toBe('Live')
    expect(ids(getView().pilots)).toEqual(['p1', 'p2'])
  })

  test('leaves off a claim no room makes, and a row only it held', () => {
    const kept = (id: string, scopes: string[]) => ({
      table: 'crawler' as const,
      id,
      row: crawler(id, 'g1'),
      version: 1,
      headSeq: undefined,
      scopes: scopes as never,
    })
    restore([kept('c1', ['wiring']), kept('c2', ['wiring', gameScope('g1')])])
    expect(ids(getView().crawlers)).toEqual(['c2'])
    serve(gameScope('g1'), ['crawler'], [])
    expect(getView().crawlers).toEqual([])
  })
})

describe('arrival', () => {
  test('waits while rows are coming, then resolves on the snapshot', async () => {
    setRowsComing(() => true)
    let done = false
    const waiting = untilArrived('pilot').then(() => {
      done = true
    })
    await Promise.resolve()
    expect(done).toBe(false)
    serve('account', ['pilot'], [])
    await waiting
    expect(done).toBe(true)
  })

  test('resolves at once when nothing is coming', async () => {
    setRowsComing(() => false)
    await untilArrived('pilot')
  })
})
