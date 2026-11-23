import { afterAll, describe, expect, mock, test } from 'bun:test'
import type { InitiativeSide } from '../../../lib/rules/initiative'
import { newRound } from '../../../lib/rules/initiative'
import type { SidesOf } from '../initiative.model'

// Encounter groups are behind `encounterSheet`: on here. Captured first, put back after.
const realFlags = { ...(await import('../../../lib/flags')) }
mock.module('../../../lib/flags', () => ({ ...realFlags, flagOn: () => true }))
afterAll(() => {
  mock.module('../../../lib/flags', () => realFlags)
})

const { fieldGroups, mediatorSides, ONE_OPPOSITION, passedSide } = await import(
  '../initiative.model'
)
const { actedAndPassed } = await import('../useInitiative')

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

describe('all the opposition is one side (r7 C4)', () => {
  const RAIDERS = { id: 'g-raiders', name: 'Raider' }
  const unit = (id: string, group: { id: string; name: string } | null) => ({
    id,
    name: id,
    down: false,
    group,
  })
  const table = {
    seats: [{ pilotId: 'p1', name: 'Pickle' }],
    npcs: [unit('r1', RAIDERS), unit('r2', RAIDERS), unit('grit', null), unit('mule', null)],
  } as unknown as SidesOf

  test('however prep added them, the enemies are one Opposition side', () => {
    expect(ONE_OPPOSITION).toBe(true)
    const sides = mediatorSides(table)
    expect(sides.map((side) => side.id)).toEqual(['pilots', 'opposition'])
    expect(sides[1]?.members.map((m) => m.id)).toEqual(['r1', 'r2', 'grit', 'mule'])
  })

  test('a group the Mediator splits off is a side of its own (Core Book p.236)', () => {
    expect(fieldGroups(table)).toEqual([RAIDERS])
    const sides = mediatorSides(table, ['g-raiders'])
    expect(sides.map((side) => side.name)).toEqual(['Pilots', 'Raider', 'Opposition'])
  })

  test('a split stays split into the next round', () => {
    expect(newRound({ round: 1, side: 'pilots', acted: ['p1'], split: ['g'] })).toEqual({
      round: 2,
      acted: [],
      split: ['g'],
    })
    expect(newRound({ round: 1, acted: [] })).toEqual({ round: 2, acted: [] })
  })
})
