import { describe, expect, test } from 'bun:test'
import { FIXTURE_NOW, mechFixture, pilotFixture } from '../../__tests__/fixtures'
import { connectionLine, gamePilots, playTitle, soloPilots } from '../play.model'

describe('playTitle', () => {
  test('the Game’s name in a Game, "Solo · <pilot>" from the shelf', () => {
    expect(playTitle({ gameId: 'g1', gameName: 'Tenacity' }, 'Rook')).toBe('Tenacity')
    expect(playTitle({ gameId: null, gameName: null }, 'Wren')).toBe('Solo · Wren')
  })

  test('a Game whose name has not arrived reads "Game"', () => {
    expect(playTitle({ gameId: 'g1', gameName: null }, 'Rook')).toBe('Game')
  })
})

describe('connectionLine', () => {
  test('says who play reaches, in every mode', () => {
    expect(connectionLine('connected', false)).toBe('Connected · changes reach the table live')
    expect(connectionLine('connected', true)).toBe('Solo · nothing is shared')
    expect(connectionLine('connecting', true)).toBe('Connecting…')
    expect(connectionLine('disconnected', false)).toBe('Not connected · waiting to reconnect')
    expect(connectionLine('solo', true)).toBe('Signed out')
  })
})

describe('the landing’s pilots', () => {
  const rook = pilotFixture({ id: 'p-rook', name: 'Rook', gameId: 'g1' })
  const wren = pilotFixture({ id: 'p-wren', name: 'Wren', gameId: null })
  const kite = pilotFixture({ id: 'p-kite', name: 'Kite', gameId: null })
  const scrapper = mechFixture({ id: 'm-scrapper', name: 'Scrapper', gameId: null })
  const link = {
    id: 'l1',
    type: 'mech-to-pilot' as const,
    from: { type: 'mech' as const, id: 'm-scrapper' },
    to: { type: 'pilot' as const, id: 'p-wren' },
    createdAt: FIXTURE_NOW,
  }

  test('Solo lists the shelf’s pilots, each with its assigned mech or none', () => {
    expect(soloPilots([rook, wren, kite], [scrapper], [link])).toEqual([
      { pilotId: 'p-wren', name: 'Wren', mechName: 'Scrapper' },
      { pilotId: 'p-kite', name: 'Kite', mechName: null },
    ])
  })

  test('a Game’s Play doors are your pilots in that Game alone', () => {
    expect(gamePilots([rook, wren, kite], 'g1').map((p) => p.id)).toEqual(['p-rook'])
    expect(gamePilots([rook, wren, kite], 'g2')).toEqual([])
  })
})
