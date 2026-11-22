/** The Change Log's words and its changes (r2 C1, C2). */

import { describe, expect, test } from 'bun:test'
import type { EntityLogRow } from '../../../rooms/ops'
import { fieldLabel, lineText, logChanges, reversal, reverseChange } from '../changeLog.model'

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
    expect(changes[0]?.fields.map((f) => f.field)).toEqual(['systems', 'chassisRef'])
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

  test('a field that was absent reverses to absent, and reads as None', () => {
    const [change] = logChanges([
      row({ _id: 'o:maxHpOverride', field: 'maxHpOverride', before: null, after: 14 }),
    ])
    expect(change?.lines.map(lineText)).toEqual(['Max hp override: None to 14'])
    expect(change && reverseChange(change, { maxHpOverride: 14 })).toEqual({
      maxHpOverride: undefined,
    })
    expect(change && reversal(change).label).toBe('Clear')
  })

  test('a number written over nothing reads from what nothing stood for (r3 B4)', () => {
    const rows = [
      row({ _id: 'a:currentSP', field: 'currentSP', before: null, after: 4 }),
      row({ _id: 'b:trainingPoints', field: 'trainingPoints', before: null, after: 1 }),
    ]
    const changes = logChanges(rows, { currentSP: 5, trainingPoints: 0 })
    expect(changes.map((c) => c.lines.map(lineText))).toEqual([
      ['Current SP: 5 to 4'],
      ['Training points: 0 to 1'],
    ])
    expect(changes[0] && reversal(changes[0], { currentSP: 5 }).label).toBe('Set back to 5')
  })

  test('a write from Play or Downtime says so, and what it was for (r3 B4)', () => {
    const changes = logChanges([
      row({ _id: 'a:currentAP', field: 'currentAP', before: 5, after: 4, source: 'play:Spotter' }),
      row({ _id: 'b:trainingPoints', field: 'trainingPoints', source: 'downtime' }),
      row({ _id: 'c:name', source: 'live-sheet' }),
    ])
    expect(changes.map((c) => [c.from, c.did])).toEqual([
      ['play', 'Spotter'],
      ['downtime', undefined],
      [undefined, undefined],
    ])
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

describe('reversing one change (r3 B1)', () => {
  const one = (over: Partial<EntityLogRow>) => {
    const [change] = logChanges([row(over)])
    if (!change) throw new Error('no change')
    return change
  }

  test('a removal puts back only what it removed, on the list as it is now', () => {
    const removed = one({
      _id: 'o:systems',
      field: 'systems',
      before: ['red-laser', 'mini-mortar', 'riveting-gun'],
      after: ['red-laser', 'riveting-gun'],
    })
    // Since then the Riveting Gun came off too: it stays off.
    expect(reverseChange(removed, { systems: ['red-laser'] })).toEqual({
      systems: ['red-laser', 'mini-mortar'],
    })
    expect(reversal(removed)).toEqual({ label: 'Put back', done: 'Put back Mini Mortar.' })
  })

  test('an addition takes off only what it added, and keeps what came after', () => {
    const added = one({
      _id: 'o:systems',
      field: 'systems',
      before: ['red-laser'],
      after: ['red-laser', 'armour-plating'],
    })
    expect(reverseChange(added, { systems: ['red-laser', 'armour-plating', 'cargo-pod'] })).toEqual(
      { systems: ['red-laser', 'cargo-pod'] }
    )
    expect(reversal(added)).toEqual({ label: 'Remove', done: 'Removed Armour Plating.' })
  })

  test('an addition already taken off again changes nothing', () => {
    const added = one({
      _id: 'o:systems',
      field: 'systems',
      before: [],
      after: ['armour-plating'],
    })
    expect(reverseChange(added, { systems: ['red-laser'] })).toEqual({ systems: ['red-laser'] })
  })

  test('a value is set back, and the button says to what', () => {
    const set = one({ _id: 'o:currentSP', field: 'currentSP', before: 5, after: 3 })
    expect(reverseChange(set, { currentSP: 1 })).toEqual({ currentSP: 5 })
    expect(reversal(set)).toEqual({ label: 'Set back to 5', done: 'Current SP set back to 5.' })
  })

  test('a lot altered in a list reads as it did, and the other lots stay', () => {
    const scrap = (units: number) => ({ id: 'y', name: 'Scrap', units })
    const altered = one({
      _id: 'o:cargoLots',
      field: 'cargoLots',
      before: [scrap(3)],
      after: [scrap(5)],
    })
    const later = { id: 'z', name: 'Salvaged Plating', units: 1 }
    expect(reverseChange(altered, { cargoLots: [scrap(5), later] })).toEqual({
      cargoLots: [scrap(3), later],
    })
  })

  test('a chassis swap goes back with what came off, as one change', () => {
    const [swap] = logChanges([
      row({ _id: 'op:chassisRef', field: 'chassisRef', before: 'scrapper', after: 'mazona' }),
      row({
        _id: 'op:systems',
        field: 'systems',
        before: ['red-laser', 'rigging-arm'],
        after: ['red-laser'],
      }),
    ])
    if (!swap) throw new Error('no change')
    expect(
      reverseChange(swap, { chassisRef: 'mazona', systems: ['red-laser', 'cargo-pod'] })
    ).toEqual({
      chassisRef: 'scrapper',
      systems: ['red-laser', 'cargo-pod', 'rigging-arm'],
    })
    expect(reversal(swap).label).toBe('Undo this change')
  })
})
