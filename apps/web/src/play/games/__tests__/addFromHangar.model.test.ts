/**
 * `hangarChoices` — what "Move in from your Training Bay" offers on a Game's page: only
 * units the move would accept (ADR-037 via `moveDestinations`), each with the
 * relation chips that show what the move touches.
 */

import { describe, expect, test } from 'bun:test'
import { hangarChoices } from '../addFromHangar.model'

const GAMES = [
  { _id: 'g1', name: 'The Rust Belt Run', tableRunner: false },
  { _id: 'g2', name: 'Frostline', tableRunner: true },
]

function choices(over: Partial<Parameters<typeof hangarChoices>[0]> = {}) {
  return hangarChoices({
    gameId: 'g1',
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    games: GAMES,
    ...over,
  })
}

describe('hangarChoices', () => {
  test('a pilot or mech comes from the Training Bay or another Game, never from this one', () => {
    const { pilot } = choices({
      pilots: [
        { id: 'p1', name: 'Kestrel', gameId: null },
        { id: 'p2', name: 'Skiv', gameId: 'g2' },
        { id: 'p3', name: 'Bonesaw', gameId: 'g1' },
      ],
    })
    expect(pilot.map((c) => c.name)).toEqual(['Kestrel', 'Skiv'])
    // From the Training Bay there is no Game to leave: the lane is empty (C6).
    expect(pilot[0]?.relations).toEqual([])
    expect(pilot[1]?.relations).toEqual([
      { key: 'game', label: 'Game', value: 'Frostline', href: '/play/games/g2' },
    ])
  })

  test('a unit’s assignment is its relation chip, so the move’s consequence shows', () => {
    const { pilot, mech } = choices({
      pilots: [{ id: 'p1', name: 'Kestrel', gameId: null }],
      mechs: [{ id: 'm1', name: 'Buzzard', gameId: null }],
      softLinks: [
        {
          id: 'l1',
          type: 'mech-to-pilot',
          from: { type: 'mech', id: 'm1' },
          to: { type: 'pilot', id: 'p1' },
        } as never,
      ],
    })
    expect(pilot[0]?.relations.map((r) => `${r.label}|${r.value}`)).toEqual(['Mech|Buzzard'])
    expect(mech[0]?.relations.map((r) => `${r.label}|${r.value}`)).toEqual(['Pilot|Kestrel'])
  })

  test('a crawler comes only from the Training Bay, into a Game you run', () => {
    const crawlers = [
      { id: 'c1', name: 'Iron Mother', gameId: null },
      { id: 'c2', name: 'Tenacity', gameId: 'g2' },
    ]
    // You do not run g1: no crawler may move in.
    expect(choices({ crawlers }).crawler).toEqual([])
    // You run g1: the Training Bay's crawler may; one in another Game never (no Game to Game).
    const running = GAMES.map((g) => ({ ...g, tableRunner: true }))
    expect(choices({ crawlers, games: running }).crawler.map((c) => c.name)).toEqual([
      'Iron Mother',
    ])
  })
})
