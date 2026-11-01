import { describe, expect, test } from 'bun:test'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import { withoutRetired } from '../schemas/retired'
import { STARTER_MECHS } from '../starterSet/starterSet'
import { foldPatternName, startingPatternRef } from '../startingPattern'

describe('where a mech started', () => {
  test('a chassis pattern, " Pattern" or not, is its slug; anything else is none', () => {
    expect(startingPatternRef('scrapper', 'Swiss Cheese Pattern')).toBe('swiss-cheese')
    expect(startingPatternRef('scrapper', ' Swiss Cheese ')).toBe('swiss-cheese')
    expect(startingPatternRef('scrapper', 'Old Rusty')).toBeUndefined()
    expect(startingPatternRef('no-such-chassis', 'Swiss Cheese')).toBeUndefined()
    expect(startingPatternRef('scrapper', '  ')).toBeUndefined()
  })

  test('an old body’s patternName becomes its ref when it names a pattern, and is dropped either way', () => {
    const old = { id: 'm1', chassisRef: 'mule', name: 'Bessie', patternName: 'Hauler Pattern' }
    expect(withoutRetired('mech', old)).toEqual({
      id: 'm1',
      chassisRef: 'mule',
      name: 'Bessie',
      startingPatternRef: 'hauler',
    })
    // A name that names no pattern of its chassis (a copied mech name) keeps nothing.
    expect(withoutRetired('mech', { ...old, patternName: 'Bessie' })).toEqual({
      id: 'm1',
      chassisRef: 'mule',
      name: 'Bessie',
    })
    // A ref already written wins over an old name.
    expect(foldPatternName({ ...old, startingPatternRef: 'crusher' })).toMatchObject({
      startingPatternRef: 'crusher',
    })
  })

  test('every Starter Set mech that names a pattern names one its chassis has', () => {
    for (const mech of STARTER_MECHS) {
      if (mech.startingPatternRef === undefined) continue
      const slugs = (resolveChassisRef(mech.chassisRef)?.patterns ?? []).map((p) =>
        startingPatternRef(mech.chassisRef, p.name)
      )
      expect(slugs).toContain(mech.startingPatternRef)
    }
  })
})
