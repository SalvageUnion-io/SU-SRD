import { describe, expect, test } from 'bun:test'
import type { MechPattern } from 'game-domain/schemas/pattern'
import { patternNameTaken } from '../../mech/Pattern/buildConfirm.model'
import { sortShelfRows } from '../mechShelf.model'
import { patternLine } from '../patternShelf.model'
import { PATTERN_COLUMNS } from '../shelfColumns'

const pattern = (over: Partial<MechPattern>): MechPattern => ({
  id: 'pat-1',
  schemaVersion: 1,
  name: 'Atlas Gunline Mk1',
  chassisRef: 'mule',
  systems: [],
  modules: [],
  createdAt: '2026-11-01T10:00:00.000Z',
  ...over,
})

const sharing = (over: Record<string, unknown>) => [
  { appId: 'pat-1', visibility: 'private' as const, gameId: null, builtCount: 0, ...over },
]

describe('a pattern’s line on its shelf (r4 E13)', () => {
  test('says how many Mechs were built from it (r7 G2)', () => {
    const mechs = [
      { sourcePattern: 'pat-1' },
      { sourcePattern: 'pat-2' },
      { sourcePattern: 'pat-1' },
      {},
    ]
    expect(patternLine(pattern({}), undefined, undefined, mechs).values['Used by']).toBe(2)
  })

  test('every column has its value: chassis, who sees it, Tech Level, slots and the day saved', () => {
    const line = patternLine(pattern({ modules: ['comms-module'] }), sharing({}), [])
    for (const column of PATTERN_COLUMNS) expect(line.values[column.key]).not.toBeUndefined()
    expect(line.values.TL).toBe(1)
    expect(String(line.values.Mod)).toMatch(/^1\/\d+$/)
    expect(String(line.values.Sys)).toMatch(/^0\/\d+$/)
    expect(line.values.who).toBe('Only me')
    // How many Mechs were built from it (r7 G2): none counted, none.
    expect(line.values['Used by']).toBe(0)
    expect(line.saved).toContain('2026')
  })

  test('Seen by reads In the Reference once it is switched on there, whatever its link says', () => {
    expect(patternLine(pattern({}), sharing({ visibility: 'link' }), []).values.who).toBe(
      'Public (anyone with the link)'
    )
    expect(
      patternLine(pattern({}), sharing({ visibility: 'link', homebrew: true }), []).values.who
    ).toBe('In the Reference')
  })

  test('two of one name sort apart by the day they were saved', () => {
    const rows = [
      pattern({ id: 'old', createdAt: '2026-10-02T09:00:00.000Z' }),
      pattern({ id: 'new', createdAt: '2026-11-20T09:00:00.000Z' }),
      pattern({ id: 'mid', createdAt: '2026-11-03T09:00:00.000Z' }),
    ].map((p) => ({ id: p.id, name: p.name, ...patternLine(p, undefined, undefined) }))
    const by = (descending: boolean) =>
      sortShelfRows(rows, { key: 'saved', descending }, (row, key) => row.values[key]).map(
        (row) => row.id
      )
    expect(by(false)).toEqual(['old', 'mid', 'new'])
    expect(by(true)).toEqual(['new', 'mid', 'old'])
  })
})

describe('two patterns of one name can be told apart (r5 D3)', () => {
  test('by their Scrap, the time they were saved and their description’s first line', () => {
    const line = patternLine(
      pattern({ notes: '  Digs fast.\nNeeds a pilot with Grit.' }),
      undefined,
      undefined
    )
    expect(line.values.Scrap).toMatch(/^TL\d+ \d+/)
    expect(line.saved).toMatch(/\d{1,2}:\d{2}/)
    expect(line.about).toBe('Digs fast.')
    expect(patternLine(pattern({}), undefined, undefined).about).toBeUndefined()
  })
})

describe('a name a saved pattern already has', () => {
  test('is taken however it is cased or spaced; a blank or a new one is not', () => {
    const held = [{ name: 'Atlas Gunline Mk1' }]
    expect(patternNameTaken(' atlas gunline mk1 ', held)).toBe(true)
    expect(patternNameTaken('Atlas Gunline Mk2', held)).toBe(false)
    expect(patternNameTaken('  ', held)).toBe(false)
  })
})
