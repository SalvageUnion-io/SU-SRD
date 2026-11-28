import { describe, expect, test } from 'bun:test'
import type { ResolveModel } from '../actionsDeck.model'
import { beatTrack, momentOf, tableBeat, tableTrack } from '../moment.model'

/** The Main display's ladder and a beat's track (`../moment.model.ts`, ADR-068). */

type Resolving = Extract<ResolveModel, { kind: 'resolve' }>

function resolving(over: Partial<Resolving> = {}, controls: Partial<Resolving['controls']> = {}) {
  return {
    kind: 'resolve',
    free: false,
    rollLeads: false,
    noRoll: false,
    applied: false,
    nothingToApply: false,
    roll: null,
    ...over,
    controls: { activated: false, ...controls },
  } as Resolving
}

describe('momentOf', () => {
  test('nothing in hand is Ready', () => {
    expect(momentOf({ stop: false, action: null, owed: [] })).toEqual({
      beat: { kind: 'ready' },
      next: [],
    })
  })

  test('the action you are in holds the display; what is owed waits on Next', () => {
    expect(momentOf({ stop: false, action: 'mortar', owed: ['heat'] })).toEqual({
      beat: { kind: 'action', key: 'mortar' },
      next: [{ kind: 'owed', key: 'heat' }],
    })
  })

  test('with no beat of your own, what is owed takes the display', () => {
    expect(momentOf({ stop: false, action: null, owed: ['heat'] }).beat).toEqual({
      kind: 'owed',
      key: 'heat',
    })
  })

  test('Stop cuts in over everything, and nothing is lost under it', () => {
    expect(momentOf({ stop: true, action: 'mortar', owed: ['heat'] })).toEqual({
      beat: { kind: 'stop' },
      next: [
        { kind: 'action', key: 'mortar' },
        { kind: 'owed', key: 'heat' },
      ],
    })
  })
})

describe('beatTrack', () => {
  test('Activate, then Roll, then Apply: the first not done is current', () => {
    expect(beatTrack(resolving())).toEqual([
      { key: 'activate', state: 'on' },
      { key: 'roll', state: 'todo' },
      { key: 'apply', state: 'todo' },
    ])
    expect(
      beatTrack(resolving({ roll: { roll: 14 } as Resolving['roll'] }, { activated: true }))
    ).toEqual([
      { key: 'activate', state: 'done' },
      { key: 'roll', state: 'done' },
      { key: 'apply', state: 'on' },
    ])
  })

  test('a roll that pays its own cost has no Activate; a Push is offered, never owed', () => {
    const push = { disabled: false, pushed: false, heat: 2, onPush: () => undefined }
    expect(
      beatTrack(resolving({ rollLeads: true, roll: { roll: 8 } as Resolving['roll'] }, { push }))
    ).toEqual([
      { key: 'roll', state: 'done' },
      { key: 'push', state: 'todo' },
      { key: 'apply', state: 'on' },
    ])
  })

  test('an item that rolls nothing and writes nothing is its Activate alone', () => {
    expect(beatTrack(resolving({ noRoll: true, nothingToApply: true }))).toEqual([])
    expect(beatTrack(resolving({ free: true, nothingToApply: true }))).toEqual([
      { key: 'roll', state: 'on' },
    ])
  })
})

describe('the Table’s Moment (tableBeat, tableTrack)', () => {
  const pilots = [
    { linkId: 'me', name: 'Bonesaw', boarded: false },
    { linkId: 'p2', name: 'Judge', boarded: true },
  ]
  const shared = {
    ref: 'k',
    name: 'Mini Mortar',
    activated: true,
    applied: false,
  }

  test('another seat’s beat from its Activate, never your own, never once applied', () => {
    expect(tableBeat([{ pilotId: 'p2', resolving: shared }], pilots, 'me')).toEqual({
      pilotId: 'p2',
      pilot: 'Judge',
      boarded: true,
      resolving: shared,
    })
    expect(tableBeat([{ pilotId: 'me', resolving: shared }], pilots, 'me')).toBeNull()
    const applied = { ...shared, applied: true }
    expect(tableBeat([{ pilotId: 'p2', resolving: applied }], pilots, 'me')).toBeNull()
    const opened = { ...shared, activated: false }
    expect(tableBeat([{ pilotId: 'p2', resolving: opened }], pilots, 'me')).toBeNull()
    const rolled = { ...opened, roll: { roll: 3, band: 'failure' as const } }
    expect(tableBeat([{ pilotId: 'p2', resolving: rolled }], pilots, 'me')?.pilot).toBe('Judge')
  })

  test('a seat the crew read does not name yet waits for it', () => {
    expect(tableBeat([{ pilotId: 'p9', resolving: shared }], pilots, 'me')).toBeNull()
  })

  test('its track: Activate, Roll, Apply, the first not done the current', () => {
    const states = (r: Parameters<typeof tableTrack>[0]) => tableTrack(r).map((s) => s.state)
    expect(states(shared)).toEqual(['done', 'on', 'todo'])
    expect(states({ ...shared, roll: { roll: 14, band: 'success' } })).toEqual([
      'done',
      'done',
      'on',
    ])
  })
})
