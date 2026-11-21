/** The Change Log's words and its changes (r2 C1, C2). */

import { describe, expect, test } from 'bun:test'
import type { EntityLogRow } from '../../../rooms/ops'
import { fieldLabel, lineText, logChanges } from '../changeLog.model'

const row = (over: Partial<EntityLogRow>): EntityLogRow => ({
  _id: 'op1:name',
  ts: 1,
  kind: 'manual',
  field: 'name',
  before: 'A',
  after: 'B',
  source: 'live-sheet',
  state: 'applied',
  ...over,
})

const texts = (rows: EntityLogRow[]) => logChanges(rows).map((c) => c.lines.map(lineText))

describe('logChanges', () => {
  test('names a chassis and the systems taken off, in full', () => {
    const before = [
      'chainsaw-arm',
      'escape-hatch',
      'locomotion-system',
      'rigging-arm',
      'red-laser',
      'mini-mortar',
    ]
    const changes = logChanges([
      row({ _id: 'op2:systems', field: 'systems', before, after: before.slice(0, 3) }),
      row({ _id: 'op2:chassisRef', field: 'chassisRef', before: 'scrapper', after: 'mazona' }),
    ])
    expect(changes).toHaveLength(1)
    expect(changes[0]?.lines.map(lineText)).toEqual([
      'Chassis: Scrapper to Mazona',
      'Removed Rigging Arm, Red Laser, Mini Mortar',
    ])
    expect(changes[0]?.before).toEqual({ chassisRef: 'scrapper', systems: before })
  })

  test('counts repeats: one of two taken off is one removed', () => {
    expect(
      texts([
        row({
          _id: 'o:systems',
          field: 'systems',
          before: ['red-laser', 'red-laser'],
          after: ['red-laser', 'mini-mortar'],
        }),
      ])
    ).toEqual([['Removed Red Laser', 'Added Mini Mortar']])
  })

  test('a field that was absent restores to absent, and reads as None', () => {
    const [change] = logChanges([
      row({ _id: 'o:maxHpOverride', field: 'maxHpOverride', before: null, after: 14 }),
    ])
    expect(change?.lines.map(lineText)).toEqual(['Max hp override: None to 14'])
    expect(change?.before).toEqual({ maxHpOverride: undefined })
  })

  test('never cuts a value', () => {
    const long = Object.fromEntries(
      Array.from({ length: 30 }, (_, i) => [`system-${i}`, 'damaged'])
    )
    const [line] = texts([
      row({ _id: 'o:systemConditions', field: 'systemConditions', before: {}, after: long }),
    ])
    expect(line?.[0]).toContain('system-29')
  })
})

describe('fieldLabel', () => {
  test('reads a field as words', () => {
    expect(fieldLabel('currentHP')).toBe('Current HP')
    expect(fieldLabel('chassisRef')).toBe('Chassis')
    expect(fieldLabel('callsign')).toBe('Callsign')
  })
})

describe('a list of named things', () => {
  test('reads by name and count, never as the stored record', () => {
    const [line] = texts([
      row({
        _id: 'o:cargoLots',
        field: 'cargoLots',
        before: null,
        after: [
          { id: 'x', kind: 'unit', name: 'Salvaged Plating', units: 1 },
          { id: 'y', kind: 'unit', name: 'Scrap', units: 3 },
        ],
      }),
    ])
    expect(line?.[0]).toContain('Salvaged Plating, Scrap ×3')
    expect(line?.[0]).not.toContain('{')
  })
})
