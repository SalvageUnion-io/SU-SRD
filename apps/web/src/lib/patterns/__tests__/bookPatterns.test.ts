import { describe, expect, test } from 'bun:test'
import { nameToSlug, SalvageUnionReference } from 'salvageunion-reference'
import { must } from '../../../components/__tests__/must'
import {
  bookPattern,
  chassisWithPatterns,
  isStartingBookPattern,
  mechFromBookPattern,
} from '../bookPatterns'

describe('book patterns', () => {
  test('every chassis that prints a pattern is offered, above Tech 1 too', () => {
    const pool = chassisWithPatterns()
    expect(pool.some((c) => typeof c.techLevel === 'number' && c.techLevel > 1)).toBe(true)
    expect(pool.every((c) => c.patterns.length > 0)).toBe(true)
  })

  test('a pattern is found by its slugs; a wrong one is nothing', () => {
    expect(bookPattern('mule', 'hauler')?.pattern.name).toBe('Hauler')
    expect(bookPattern('mule', 'nope')).toBeUndefined()
    expect(bookPattern(undefined, 'hauler')).toBeUndefined()
  })

  test('a starting pattern is a Tech 1 chassis’s flagged one', () => {
    const mule = must(SalvageUnionReference.Chassis.getByName('Mule'))
    expect(isStartingBookPattern(mule, must(bookPattern('mule', 'hauler')).pattern)).toBe(true)
    expect(isStartingBookPattern(mule, must(bookPattern('mule', 'crusher')).pattern)).toBe(false)
  })

  test('the mech is the pattern as printed: its name, chassis and every copy', () => {
    const { chassis, pattern } = must(bookPattern('mule', 'crusher'))
    const mech = mechFromBookPattern(chassis, pattern)
    expect(mech.name).toBe('Crusher 1')
    expect(mech.chassisRef).toBe('mule')
    expect(mech.systems).toEqual(
      pattern.systems.flatMap((s) => new Array<string>(s.count ?? 1).fill(nameToSlug(s.name)))
    )
    expect(mech.modules).toEqual(
      pattern.modules.flatMap((m) => new Array<string>(m.count ?? 1).fill(nameToSlug(m.name)))
    )
  })
})
