/**
 * The pure halves of what the Dashboard reads and writes about the table:
 * how a crewmate's resolve reads (plan §8 A6), the Crew tab's lines, and the
 * change-log row a Dashboard roll becomes (`botClient.recordRoll`'s shape).
 */

import { describe, expect, test } from 'bun:test'
import type { Id } from '../../../../convex/_generated/dataModel'
import type { MechStatus } from '../../../lib/rules/crewStatus'
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
        linkId: 'vex',
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
        linkId: 'rook',
        name: 'Rook',
        boarded: false,
        mechId: 'kettle',
      },
      {
        ...pilot,
        _id: 'r4' as Id<'pilots'>,
        appId: 'wren',
        linkId: 'wren',
        name: 'Wren',
        boarded: false,
        mechId: null,
        status: { ...calm, ejected: true },
        attention: true,
      },
    ],
    mechs: [
      {
        ...mech,
        _id: 'r3' as Id<'mechs'>,
        appId: 'magpie',
        linkId: 'magpie',
        name: 'Magpie',
        currentHeat: 4,
        status: { ...sound, overheating: true, destroyedSystems: ['Heat Sink'] },
        attention: true,
      },
      {
        ...mech,
        _id: 'r6' as Id<'mechs'>,
        appId: 'kettle',
        linkId: 'kettle',
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
        mechAttention: true,
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
        // Boarded, its trouble is the row's problems, not its line.
        mechAttention: false,
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
        mechAttention: false,
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
          linkId: 'rook',
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

  test('a parked mech that draws the outline says why', () => {
    const parked = (status: Partial<MechStatus>): CrewVitals => ({
      ...crew,
      pilots: [
        {
          ...pilot,
          _id: 'r2' as Id<'pilots'>,
          appId: 'rook',
          linkId: 'rook',
          name: 'Rook',
          boarded: false,
          mechId: 'kettle',
        },
      ],
      mechs: [
        {
          ...mech,
          _id: 'r6' as Id<'mechs'>,
          appId: 'kettle',
          linkId: 'kettle',
          name: 'Kettle',
          status: { ...sound, ...status },
          attention: true,
        },
      ],
    })
    const line = (status: Partial<MechStatus>) => crewLines(parked(status), [], 'rook')[0]

    const systems = line({ destroyedSystems: ['Heat Sink'] })
    expect(systems?.mech).toBe('Kettle parked, 1 system destroyed')
    expect(systems?.mechAttention).toBe(true)
    expect(systems?.attention).toBe(true)
    expect(line({ overheating: true })?.mech).toBe('Kettle parked, overheating')
    expect(line({ destroyedModules: ['Cargo Bay', 'Drill'] })?.mech).toBe(
      'Kettle parked, 2 modules destroyed'
    )
  })

  test('a template pre-gen, with no app id, is keyed by its link id', () => {
    // Starter Set rows (`templates.createGame`) carry only a body id; the
    // seats and `mechId` name them by it, and `/sheet/$kind/$id` resolves it.
    const template: CrewVitals = {
      ...crew,
      pilots: [
        {
          ...pilot,
          _id: 'r7' as Id<'pilots'>,
          appId: null,
          linkId: 'pregen-pilot',
          name: 'Pre-gen',
          currentHP: 6,
          boarded: true,
          mechId: 'pregen-mech',
        },
        {
          ...pilot,
          _id: 'r9' as Id<'pilots'>,
          appId: null,
          linkId: 'pregen-walker',
          name: 'Walker',
          boarded: false,
          mechId: 'pregen-spare',
        },
      ],
      mechs: [
        {
          ...mech,
          _id: 'r8' as Id<'mechs'>,
          appId: null,
          linkId: 'pregen-mech',
          name: 'Starter',
          currentSP: 9,
          currentHeat: 1,
        },
        {
          ...mech,
          _id: 'r10' as Id<'mechs'>,
          appId: null,
          linkId: 'pregen-spare',
          name: 'Spare',
        },
      ],
    }
    const templateSeats: BoardSources['seats'] = [
      {
        pilotId: 'pregen-pilot',
        mount: { kind: 'boarded', mechId: 'pregen-mech' },
        resolving: crush,
      },
    ]
    const [boarded, onFoot] = crewLines(template, templateSeats, 'pregen-pilot')
    expect(boarded).toMatchObject({
      pilotId: 'pregen-pilot',
      self: true,
      href: '/sheet/pilot/pregen-pilot',
      where: 'In Starter',
      vitals: 'HP 6/10 · AP 5/5',
      mech: 'Starter · SP 9/12 · Heat 1/4',
      resolving: 'Pre-gen is resolving Crush',
    })
    expect(onFoot).toMatchObject({
      pilotId: 'pregen-walker',
      where: 'On foot',
      vitals: 'HP 10/10 · AP 5/5',
      mech: 'Spare parked',
      mechAttention: false,
    })
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
