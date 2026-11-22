import { describe, expect, test } from 'bun:test'
import {
  firstSideOf,
  initiativeSides,
  newRound,
  nextSide,
  OPPOSITION_SIDE,
  PILOTS_SIDE,
  roundDone,
  sideFor,
  withActed,
} from '../initiative'

const NAMES = { pilots: 'Pilots', opposition: 'Opposition' }
const raider = (id: string, group: { id: string; name: string } | null = null, down = false) => ({
  id,
  name: id,
  down,
  group,
})
const LANCE = { id: 'g1', name: 'Corpo lance' }

describe('Group Initiative (Core Book p.235–236)', () => {
  test('the roll: 11 and up the Pilots act first, 10 and under the NPCs', () => {
    expect([1, 5, 10, 11, 19, 20].map(firstSideOf)).toEqual([
      'opposition',
      'opposition',
      'opposition',
      'pilots',
      'pilots',
      'pilots',
    ])
  })

  test('the sides: the Pilots, each group, then the units in none as one; the downed in none', () => {
    const sides = initiativeSides(
      [{ id: 'p1', name: 'Ada' }],
      [raider('n1', LANCE), raider('n2'), raider('n3', LANCE), raider('n4', null, true)],
      NAMES
    )
    expect(sides.map((s) => [s.id, s.members.map((m) => m.id)])).toEqual([
      [PILOTS_SIDE, ['p1']],
      ['g1', ['n1', 'n3']],
      [OPPOSITION_SIDE, ['n2']],
    ])
    expect(sideFor('opposition', sides)).toBe('g1')
    expect(sideFor('pilots', sides)).toBe(PILOTS_SIDE)
    expect(nextSide(sides, PILOTS_SIDE)).toBe('g1')
    expect(nextSide(sides, OPPOSITION_SIDE)).toBe(PILOTS_SIDE)
    expect(nextSide(sides, undefined)).toBe(PILOTS_SIDE)
  })

  test('a round: begun with nobody acted, done once everyone standing has', () => {
    const sides = initiativeSides([{ id: 'p1', name: 'Ada' }], [raider('n1')], NAMES)
    const first = newRound(null)
    expect(first).toEqual({ round: 1, acted: [] })
    const acted = withActed(withActed(first, 'p1', true), 'n1', true)
    expect(roundDone(acted, sides)).toBe(true)
    expect(roundDone(withActed(acted, 'n1', false), sides)).toBe(false)
    expect(newRound(acted)).toEqual({ round: 2, acted: [] })
  })
})
