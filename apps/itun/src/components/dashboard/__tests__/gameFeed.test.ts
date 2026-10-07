/**
 * The pure halves of what the Dashboard reads and writes about the table:
 * how a crewmate's resolve reads (plan §8 A6), the Crew tab's lines, and the
 * change-log row a Dashboard roll becomes (`botClient.recordRoll`'s shape).
 */

import { describe, expect, test } from 'bun:test'
import type { Id } from '../../../../convex/_generated/dataModel'
import type { BoardSources } from '../boardMenu'
import { rollLogEntry } from '../dashboardRolls'
import type { CrewVitals } from '../useGameFeed'
import { crewLines, describeResolve } from '../useGameFeed'

const crush = { ref: 'k', name: 'Crush', activated: false, applied: false }

describe('describeResolve', () => {
  test('the action, then how far it has got', () => {
    expect(describeResolve('Rook', crush)).toBe('Rook is resolving Crush')
    expect(describeResolve('Rook', { ...crush, activated: true })).toBe(
      'Rook is resolving Crush: activated'
    )
    const rolled = { ...crush, activated: true, roll: { roll: 8, band: 'tough' as const } }
    expect(describeResolve('Rook', rolled)).toBe('Rook is resolving Crush: rolled 8, Tough Choice')
    expect(describeResolve('Rook', { ...rolled, applied: true })).toBe(
      'Rook is resolving Crush: rolled 8, Tough Choice, applied'
    )
  })
})

describe('crewLines', () => {
  const calm = { dead: false, injured: false, ejected: false }
  const sound = {
    destroyed: false,
    shutdown: false,
    overheating: false,
    destroyedSystems: [],
    destroyedModules: [],
  }
  const pilot = {
    ownerId: null,
    ownerName: null,
    currentHP: null,
    currentAP: null,
    maxHP: 10,
    maxAP: 5,
    status: calm,
    attention: false,
  }
  const mech = {
    ownerId: null,
    ownerName: null,
    currentSP: null,
    currentEP: null,
    currentHeat: null,
    maxSP: 12,
    maxEP: 6,
    maxHeat: 4,
    status: sound,
    attention: false,
  }
  const crew: CrewVitals = {
    viewerId: 'me' as Id<'users'>,
    pilots: [
      {
        ...pilot,
        _id: 'r1' as Id<'pilots'>,
        appId: 'vex',
        name: 'Vex',
        currentHP: 3,
        boarded: true,
        mechId: 'magpie',
        status: { ...calm, injured: true },
        attention: true,
      },
      {
        ...pilot,
        _id: 'r2' as Id<'pilots'>,
        appId: 'rook',
        name: 'Rook',
        boarded: false,
        mechId: 'kettle',
      },
      {
        ...pilot,
        _id: 'r4' as Id<'pilots'>,
        appId: 'wren',
        name: 'Wren',
        boarded: false,
        mechId: null,
        status: { ...calm, ejected: true },
        attention: true,
      },
      // A template pre-gen nobody has picked up has no app id: no row.
      {
        ...pilot,
        _id: 'r5' as Id<'pilots'>,
        appId: null,
        name: 'Pre-gen',
        boarded: false,
        mechId: null,
      },
    ],
    mechs: [
      {
        ...mech,
        _id: 'r3' as Id<'mechs'>,
        appId: 'magpie',
        name: 'Magpie',
        currentHeat: 4,
        status: { ...sound, overheating: true, destroyedSystems: ['Heat Sink'] },
        attention: true,
      },
      {
        ...mech,
        _id: 'r6' as Id<'mechs'>,
        appId: 'kettle',
        name: 'Kettle',
        status: { ...sound, destroyed: true },
        attention: true,
      },
    ],
  }
  const seats: BoardSources['seats'] = [
    { pilotId: 'vex', mount: { kind: 'boarded', mechId: 'magpie' }, resolving: crush },
    { pilotId: 'rook', mount: { kind: 'foot' }, resolving: null },
  ]

  test('one line per crewmate, this seat first, with their numbers and their problems', () => {
    expect(crewLines(crew, seats, 'rook')).toEqual([
      {
        pilotId: 'rook',
        name: 'Rook',
        self: true,
        href: '/sheet/pilot/rook',
        where: 'On foot',
        vitals: 'HP 10/10 · AP 5/5',
        // Parked: one line, and its own trouble does not take the row's SP
        // and Heat with it.
        mech: 'Kettle parked, destroyed',
        problems: [],
        attention: true,
        resolving: null,
      },
      {
        pilotId: 'vex',
        name: 'Vex',
        self: false,
        href: '/sheet/pilot/vex',
        where: 'In Magpie',
        vitals: 'HP 3/10 · AP 5/5',
        mech: 'Magpie · SP 12/12 · Heat 4/4',
        problems: ['Injured', 'Overheating', 'Heat Sink destroyed'],
        attention: true,
        resolving: 'Vex is resolving Crush',
      },
      {
        pilotId: 'wren',
        name: 'Wren',
        self: false,
        href: '/sheet/pilot/wren',
        where: 'On foot',
        vitals: 'HP 10/10 · AP 5/5',
        mech: null,
        problems: ['Ejected'],
        attention: true,
        resolving: null,
      },
    ])
  })

  test('an unreadable maximum shows the stored number, or a dash', () => {
    const blind: CrewVitals = {
      ...crew,
      pilots: [
        {
          ...pilot,
          _id: 'r1' as Id<'pilots'>,
          appId: 'rook',
          name: 'Rook',
          currentHP: 7,
          maxHP: null,
          maxAP: null,
          boarded: false,
          mechId: null,
        },
      ],
    }
    expect(crewLines(blind, [], 'rook')[0]?.vitals).toBe('HP 7 · AP —')
  })

  test('nothing before the crew arrives', () => {
    expect(crewLines(null, seats, 'rook')).toEqual([])
  })
})

describe('rollLogEntry', () => {
  test("a Game row in the bot's shape, from the Dashboard", () => {
    const roll = {
      description: 'Rook · Crush: 14, Success',
      result: { kind: 'core' as const, roll: 14, outcome: 'success' },
    }
    expect(rollLogEntry('g1', roll, 5)).toEqual({
      gameId: 'g1',
      entityType: 'game',
      entityId: 'g1',
      ts: 5,
      kind: 'transaction',
      field: 'roll',
      before: null,
      after: roll,
      source: 'dashboard',
    })
  })
})
