import { describe, expect, test } from 'bun:test'
import type { InitiativeSide } from '../../../lib/rules/initiative'
import { passedSide } from '../initiative.model'
import { actedAndPassed } from '../useInitiative'

/** r7 C3 (MD7-04): turns run themselves, so the Mediator presses only New round. */
const SIDES: InitiativeSide[] = [
  { id: 'pilots', name: 'Pilots', members: [{ id: 'p1', name: 'Pickle' }] },
  {
    id: 'opposition',
    name: 'Opposition',
    members: [
      { id: 'r1', name: 'Raider 1' },
      { id: 'r2', name: 'Raider 2' },
    ],
  },
]

describe('play passes on by itself (r7 C3)', () => {
  test('a side still to act keeps play', () => {
    expect(passedSide({ round: 1, side: 'opposition', acted: ['r1'] }, SIDES)).toBeNull()
  })

  test('a side all acted passes to the next still to act', () => {
    expect(passedSide({ round: 1, side: 'pilots', acted: ['p1'] }, SIDES)).toEqual({
      round: 1,
      side: 'opposition',
      acted: ['p1'],
    })
  })

  test('round the table: the last side passes back to one still to act', () => {
    expect(passedSide({ round: 1, side: 'opposition', acted: ['r1', 'r2'] }, SIDES)?.side).toBe(
      'pilots'
    )
  })

  test('with everyone done, or nobody yet up, nothing passes', () => {
    expect(passedSide({ round: 1, side: 'pilots', acted: ['p1', 'r1', 'r2'] }, SIDES)).toBeNull()
    expect(passedSide({ round: 1, acted: ['p1'] }, SIDES)).toBeNull()
  })

  test('an NPC’s rolled action marks it Acted, and passes its side when it is the last', () => {
    const start = { round: 1, side: 'opposition', acted: ['r1'] }
    expect(actedAndPassed(start, 'r2', SIDES)).toEqual({
      round: 1,
      side: 'pilots',
      acted: ['r1', 'r2'],
    })
    expect(actedAndPassed({ ...start, acted: [] }, 'r2', SIDES)).toEqual({
      round: 1,
      side: 'opposition',
      acted: ['r2'],
    })
  })
})
