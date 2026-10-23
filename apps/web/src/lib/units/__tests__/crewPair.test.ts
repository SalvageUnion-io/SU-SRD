import { describe, expect, test } from 'bun:test'
import { crewPair, gauge, pool } from '../crewPair'

/** A pilot and its mech as one linked Mini, its form following where the pilot is. */

const PILOT = {
  id: 'p1',
  name: 'Rook',
  href: '/pilots/p1',
  readings: [{ label: 'HP', value: '4/10' }],
}
const MECH = {
  id: 'm1',
  name: 'Spectrum',
  href: '/mechs/m1',
  readings: [{ label: 'SP', value: '6/9' }],
}

describe('crewPair', () => {
  test('boarded: the mech, its stats, a PILOT chip naming who is aboard', () => {
    const unit = crewPair({ pilot: PILOT, mech: MECH, boarded: true })
    expect(unit).toMatchObject({ kind: 'mech', name: 'Spectrum', href: '/mechs/m1' })
    expect(unit.readings).toEqual([{ label: 'SP', value: '6/9' }])
    expect(unit.relations?.map((r) => [r.name, r.param, r.href])).toEqual([
      ['Pilot', 'Rook', '/pilots/p1'],
    ])
  })

  test('not boarded: the pilot, its stats, a MECH chip naming its mech', () => {
    const unit = crewPair({ pilot: PILOT, mech: MECH, boarded: false })
    expect(unit).toMatchObject({ kind: 'pilot', name: 'Rook', href: '/pilots/p1' })
    expect(unit.readings).toEqual([{ label: 'HP', value: '4/10' }])
    expect(unit.relations?.map((r) => [r.name, r.param])).toEqual([['Mech', 'Spectrum']])
  })

  test('no mech: the pilot alone, boarded or not', () => {
    for (const boarded of [true, false]) {
      const unit = crewPair({ pilot: PILOT, mech: null, boarded })
      expect(unit.kind).toBe('pilot')
      expect(unit.relations).toBeUndefined()
    }
  })
})

describe('pool', () => {
  test('current/max, an absent current full, nothing without a max', () => {
    expect(pool('HP', 4, 10)).toEqual([{ label: 'HP', value: '4/10' }])
    expect(pool('HP', null, 10)).toEqual([{ label: 'HP', value: '10/10' }])
    expect(pool('HP', 4, null)).toEqual([])
    expect(pool('HP', 12, 10)).toEqual([{ label: 'HP', value: '10/10' }])
  })
})

describe('gauge', () => {
  test('current/max, an absent current empty, nothing without a max', () => {
    expect(gauge('Heat', 3, 9)).toEqual([{ label: 'Heat', value: '3/9' }])
    expect(gauge('Heat', null, 9)).toEqual([{ label: 'Heat', value: '0/9' }])
    expect(gauge('Heat', 3, null)).toEqual([])
  })
})
