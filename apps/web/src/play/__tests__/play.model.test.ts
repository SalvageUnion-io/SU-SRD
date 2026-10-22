import { describe, expect, test } from 'bun:test'
import { FIXTURE_NOW, mechFixture, pilotFixture } from '../../components/__tests__/fixtures'
import { CHAPTER_BAND_COLOR } from '../../components/atoms/chapterBandColor'
import { foregroundOn } from '../../design/contrast'
import {
  connectionLine,
  gamePilots,
  PHASE_TONE,
  playStamp,
  playTitle,
  soloPilots,
} from '../play.model'

describe('playTitle', () => {
  test('the Game’s name in a Game, the pilot’s from the shelf', () => {
    expect(playTitle({ gameId: 'g1', gameName: 'Tenacity' }, 'Rook')).toBe('Tenacity')
    expect(playTitle({ gameId: null, gameName: null }, 'Wren')).toBe('Wren')
  })

  test('a Game whose name has not arrived reads "Game"', () => {
    expect(playTitle({ gameId: 'g1', gameName: null }, 'Rook')).toBe('Game')
  })
})

describe('playStamp', () => {
  test('a solo screen wears the Solo chip; a Game’s none', () => {
    expect(playStamp({ gameId: null })).toBe('Solo')
    expect(playStamp({ gameId: 'g1' })).toBeUndefined()
  })
})

describe('PHASE_TONE', () => {
  test('on foot the pilot’s orange, Boarded the mech’s green, Downtime the Cantina’s pink', () => {
    expect(CHAPTER_BAND_COLOR[PHASE_TONE.onFoot]).toBe(CHAPTER_BAND_COLOR.pilot)
    expect(CHAPTER_BAND_COLOR[PHASE_TONE.boarded]).toBe(CHAPTER_BAND_COLOR.mech)
    expect(CHAPTER_BAND_COLOR[PHASE_TONE.downtime]).toBe(CHAPTER_BAND_COLOR.play)
  })

  test('the Mediator’s Scene is the Denizens navy', () => {
    expect(CHAPTER_BAND_COLOR[PHASE_TONE.scene]).toBe(CHAPTER_BAND_COLOR.denizen)
  })

  test('every phase is its own colour, each with a foreground that prints on it', () => {
    const bands = Object.values(PHASE_TONE).map((tone) => CHAPTER_BAND_COLOR[tone])
    expect(new Set(bands).size).toBe(bands.length)
    for (const band of bands) expect(['ink', 'paper']).toContain(foregroundOn(band))
  })
})

describe('connectionLine', () => {
  test('says who play reaches, in every mode', () => {
    expect(connectionLine('connected', false)).toBe('Connected · changes reach the table live')
    expect(connectionLine('connected', true)).toBe('Solo · nothing is shared')
    expect(connectionLine('connecting', true)).toBe('Connecting…')
    expect(connectionLine('disconnected', false)).toBe('Disconnected · waiting to reconnect')
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

  test('Solo lists the shelf’s pilots, each with its assigned mech or none, and its HP and AP', () => {
    const solo = soloPilots([rook, wren, kite], [scrapper], [link])
    expect(solo.map(({ readings: _, ...p }) => p)).toEqual([
      { pilotId: 'p-wren', name: 'Wren', mechName: 'Scrapper', mechId: 'm-scrapper' },
      { pilotId: 'p-kite', name: 'Kite', mechName: null, mechId: null },
    ])
    expect(solo[0]?.readings.map((r) => r.label)).toEqual(['HP', 'AP'])
  })

  test('a Game’s Play doors are your pilots in that Game alone', () => {
    expect(gamePilots([rook, wren, kite], 'g1').map((p) => p.id)).toEqual(['p-rook'])
    expect(gamePilots([rook, wren, kite], 'g2')).toEqual([])
  })
})
