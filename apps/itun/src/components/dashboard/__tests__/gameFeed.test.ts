/**
 * The pure halves of what the Dashboard reads and writes about the table:
 * how a crewmate's resolve reads (plan §8 A6), the Crew tab's lines, and the
 * change-log row a Dashboard roll becomes (`botClient.recordRoll`'s shape).
 */

import { describe, expect, test } from 'bun:test'
import type { BoardSources } from '../boardMenu'
import { rollLogEntry } from '../dashboardRolls'
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
  const sources: BoardSources = {
    viewerId: 'me',
    listing: {
      pilots: [
        { _id: 'r1', appId: 'vex', ownerId: 'them', body: { name: 'Vex' } },
        { _id: 'r2', appId: 'rook', ownerId: 'me', body: { name: 'Rook' } },
      ],
      mechs: [{ _id: 'r3', appId: 'magpie', ownerId: 'them', body: { name: 'Magpie' } }],
      softLinks: [],
    },
    seats: [
      { pilotId: 'vex', mount: { kind: 'boarded', mechId: 'magpie' }, resolving: crush },
      { pilotId: 'rook', mount: { kind: 'foot' }, resolving: null },
    ],
  }

  test('one line per pilot, this seat first, with where they are and what they resolve', () => {
    expect(crewLines(sources, 'rook')).toEqual([
      { pilotId: 'rook', name: 'Rook', self: true, where: 'On foot', resolving: null },
      {
        pilotId: 'vex',
        name: 'Vex',
        self: false,
        where: 'In Magpie',
        resolving: 'Vex is resolving Crush',
      },
    ])
  })

  test('nothing before the listing arrives', () => {
    expect(crewLines({ ...sources, listing: null }, 'rook')).toEqual([])
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
