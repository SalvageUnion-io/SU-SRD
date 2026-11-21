import { describe, expect, test } from 'bun:test'
import { pilotFixture } from '../../components/__tests__/fixtures'
import { CHAPTER_BAND_COLOR } from '../../components/atoms/chapterBandColor'
import { foregroundOn } from '../../design/contrast'
import { connectionLine, gamePilots, PHASE_TONE, playStamp, playTitle } from '../play.model'

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
  test('says who play reaches while live, and nothing otherwise', () => {
    expect(connectionLine('live', false)).toBe('Connected · changes reach the table live')
    expect(connectionLine('live', true)).toBe('Solo · nothing is shared')
    expect(connectionLine('syncing', true)).toBeNull()
    expect(connectionLine('offline', false)).toBeNull()
    expect(connectionLine('signedOut', true)).toBeNull()
  })
})

describe('the landing’s pilots', () => {
  const rook = pilotFixture({ id: 'p-rook', name: 'Rook', gameId: 'g1' })
  const wren = pilotFixture({ id: 'p-wren', name: 'Wren', gameId: null })
  const kite = pilotFixture({ id: 'p-kite', name: 'Kite', gameId: null })
  test('a Game’s Play doors are your pilots in that Game alone', () => {
    expect(gamePilots([rook, wren, kite], 'g1').map((p) => p.id)).toEqual(['p-rook'])
    expect(gamePilots([rook, wren, kite], 'g2')).toEqual([])
  })
})
