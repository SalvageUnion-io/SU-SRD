/** The Change Log's words and its changes (r2 C1, C2). */

import { describe, expect, test } from 'bun:test'
import type { EntityLogRow } from '../../../rooms/ops'
import {
  changeWhat,
  fieldLabel,
  lastUndoable,
  lineText,
  logChanges,
  logStory,
  reversal,
  reverseChange,
  reversible,
  splitJustNow,
  takeBack,
} from '../changeLog.model'

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

  test('a sheet write made for an item names it, and no surface (r5 C9)', () => {
    const [change] = logChanges([
      row({
        _id: 'a:currentEP',
        field: 'currentEP',
        before: 4,
        after: 3,
        source: 'live-sheet:Zoom Optics',
      }),
    ])
    expect([change?.from, change?.did]).toEqual([undefined, 'Zoom Optics'])
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
    expect(reversal(removed)).toEqual({
      label: 'Put back',
      done: 'Put back Mini Mortar.',
      was: 'Put back',
    })
  })

  test('a removal goes back to the row it came from, not the end (r6 E15)', () => {
    const removed = one({
      _id: 'o:systems',
      field: 'systems',
      before: ['locomotion-system', 'escape-hatch', 'chainsaw-arm', 'red-laser'],
      after: ['locomotion-system', 'escape-hatch', 'red-laser'],
    })
    expect(
      reverseChange(removed, { systems: ['locomotion-system', 'escape-hatch', 'red-laser'] })
    ).toEqual({ systems: ['locomotion-system', 'escape-hatch', 'chainsaw-arm', 'red-laser'] })
    const first = one({
      _id: 'p:systems',
      field: 'systems',
      before: ['chainsaw-arm', 'red-laser'],
      after: ['red-laser'],
    })
    expect(reverseChange(first, { systems: ['red-laser'] })).toEqual({
      systems: ['chainsaw-arm', 'red-laser'],
    })
  })

  test('the menu names what Undo takes back (r6 E15)', () => {
    const removed = one({
      _id: 'o:systems',
      field: 'systems',
      before: ['red-laser', 'mini-mortar'],
      after: ['red-laser'],
    })
    expect(changeWhat(removed)).toBe('remove Mini Mortar')
    const set = one({ _id: 'o:currentSP', field: 'currentSP', before: 5, after: 3 })
    expect(changeWhat(set)).toBe('Current SP: 5 to 3')
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
    expect(reversal(added)).toEqual({
      label: 'Remove',
      done: 'Removed Armour Plating.',
      was: 'Removed again',
    })
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
    expect(reversal(set)).toEqual({
      label: 'Set back to 5',
      done: 'Current SP set back to 5.',
      was: 'Set back to 5',
    })
  })

  test('an absent number reads as what it stands for on either side, and its Set back names it (r5 C7)', () => {
    const rows = [
      row({ _id: 'a:currentHeat', field: 'currentHeat', before: 1, after: null }),
      row({ _id: 'b:currentSP', field: 'currentSP', before: 9, after: null }),
      row({ _id: 'c:currentSP', field: 'currentSP', before: null, after: 9 }),
    ]
    const defaults = { currentHeat: 0, currentSP: 10 }
    const changes = logChanges(rows, defaults)
    expect(changes.map((c) => c.lines.map(lineText))).toEqual([
      ['Current heat: 1 to 0'],
      ['Current SP: 9 to 10'],
      ['Current SP: 10 to 9'],
    ])
    expect(changes.map((c) => reversal(c, defaults).label)).toEqual([
      'Set back to 1',
      'Set back to 9',
      'Set back to 10',
    ])
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
      // Back where it stood, after the Red Laser (r6 E15).
      systems: ['red-laser', 'rigging-arm', 'cargo-pod'],
    })
    expect(reversal(swap).label).toBe('Undo this change')
  })
})

describe('a change is taken back once (r4 E2, E3)', () => {
  const removed = (id: string, source = 'live-sheet') =>
    row({ _id: `${id}:systems`, field: 'systems', before: ['red-laser'], after: [], source })
  const added = (id: string, source: string) =>
    row({ _id: `${id}:systems`, field: 'systems', before: [], after: ['red-laser'], source })

  test('a write that names a change marks it taken back, and offers neither again', () => {
    const [undo, original] = logChanges([added('op2', 'live-sheet-undo:op1'), removed('op1')])
    expect(original?.reversed).toBe(true)
    expect(undo?.reverses).toEqual({ id: 'op1', again: false })
    expect(reversible(original as never)).toBe(false)
    expect(reversible(undo as never)).toBe(false)
  })

  test('a redo makes the change stand again', () => {
    const changes = logChanges([
      removed('op3', 'live-sheet-redo:op1'),
      added('op2', 'live-sheet-undo:op1'),
      removed('op1'),
    ])
    expect(changes[2]?.reversed).toBeUndefined()
    expect(lastUndoable(changes)?.id).toBe('op1')
  })

  test('stepping back skips what is already taken back, one change at a time', () => {
    const rows = [removed('op2'), row({ _id: 'op1:name' })]
    expect(lastUndoable(logChanges(rows))?.id).toBe('op2')
    const after = [added('op3', 'live-sheet-undo:op2'), ...rows]
    expect(lastUndoable(logChanges(after))?.id).toBe('op1')
    const last = [row({ _id: 'op4:name', before: 'B', after: 'A', source: 'live-sheet-undo:op1' })]
    expect(lastUndoable(logChanges([...last, ...after]))).toBeUndefined()
  })

  test('a proposal still unanswered is never the one stepped back', () => {
    expect(lastUndoable(logChanges([row({ state: 'proposed' })]))).toBeUndefined()
  })

  test('changes that arrive while the dialog is open sit apart, and the rest keep their order', () => {
    const changes = logChanges([removed('op3'), removed('op2'), row({ _id: 'op1:name' })])
    const { justNow, earlier } = splitJustNow(changes, new Set(['op2', 'op1']))
    expect(justNow.map((c) => c.id)).toEqual(['op3'])
    expect(earlier.map((c) => c.id)).toEqual(['op2', 'op1'])
  })
})

describe('takeBack: a removal put back on the sheet as it is now (r4 E3)', () => {
  test('each of several removals puts back only its own item', () => {
    const start = { systems: ['a', 'b', 'c'] }
    const first = { systems: ['b', 'c'] }
    const second = { systems: ['c'] }
    // Undo the FIRST removal after the second: b stays off. Each goes back where it stood (r6 E15).
    expect(takeBack(second, start, first)).toEqual({ systems: ['a', 'c'] })
    expect(takeBack({ systems: ['a', 'c'] }, first, second)).toEqual({ systems: ['a', 'b', 'c'] })
  })

  test('a keyed record gets back only the keys the edit dropped', () => {
    type Loadout = { systems: string[]; itemChoices: Record<string, Record<string, string>> }
    const was: Loadout = { systems: ['a'], itemChoices: { a: { x: 'one' }, b: { y: 'two' } } }
    const after: Loadout = { systems: [], itemChoices: { b: { y: 'two' } } }
    const now: Loadout = { systems: ['z'], itemChoices: { b: { y: 'three' } } }
    expect(takeBack(now, was, after)).toEqual({
      systems: ['z', 'a'],
      itemChoices: { a: { x: 'one' }, b: { y: 'three' } },
    })
  })
})

describe("the log as the sheet's story (r6 E14)", () => {
  const sp = (id: string, ts: number, before: number, after: number, source = 'live-sheet') =>
    row({ _id: `${id}:currentSP`, field: 'currentSP', ts, before, after, source })

  test('quick taps on one value read as one line, and its Set back takes the run back', () => {
    const story = logStory(
      logChanges([sp('c', 3000, 8, 6), sp('b', 2000, 9, 8), sp('a', 1000, 10, 9)])
    )
    expect(story).toHaveLength(1)
    const [line] = story
    if (!line) throw new Error('no line')
    expect(line.lines.map(lineText)).toEqual(['Current SP: 10 to 6'])
    expect(reversal(line).label).toBe('Set back to 10')
    expect(reverseChange(line, { currentSP: 6 })).toEqual({ currentSP: 10 })
    // Taking the merged line back marks each tap it stood for taken back.
    const undo = sp('u', 4000, 6, 10, `live-sheet-undo:${line.id}`)
    expect(
      logStory(logChanges([undo, sp('c', 3000, 8, 6), sp('b', 2000, 9, 8), sp('a', 1000, 10, 9)]))
    ).toEqual([])
  })

  test('taps far apart, or on another value, stay apart', () => {
    const later = 1000 + 61_000
    const story = logStory(
      logChanges([
        sp('b', later, 9, 8),
        row({ _id: 'h:currentHeat', field: 'currentHeat', ts: 1500, before: 0, after: 2 }),
        sp('a', 1000, 10, 9),
      ])
    )
    expect(story.map((c) => c.lines.map(lineText))).toEqual([
      ['Current SP: 9 to 8'],
      ['Current heat: 0 to 2'],
      ['Current SP: 10 to 9'],
    ])
  })

  test('an undo takes its change out of the story and a redo puts it back, with no rows of their own', () => {
    const add = row({ _id: 'a:systems', field: 'systems', ts: 1, before: [], after: ['red-laser'] })
    const undo = row({
      _id: 'u:systems',
      field: 'systems',
      ts: 2,
      before: ['red-laser'],
      after: [],
      source: 'live-sheet-undo:a',
    })
    expect(logStory(logChanges([undo, add]))).toEqual([])
    const redo = row({
      _id: 'r:systems',
      field: 'systems',
      ts: 3,
      before: [],
      after: ['red-laser'],
      source: 'live-sheet-redo:a',
    })
    expect(logStory(logChanges([redo, undo, add])).map((c) => c.id)).toEqual(['a'])
  })

  test('a run that ends where it started says nothing', () => {
    expect(logStory(logChanges([sp('b', 2000, 9, 10), sp('a', 1000, 10, 9)]))).toEqual([])
  })
})
