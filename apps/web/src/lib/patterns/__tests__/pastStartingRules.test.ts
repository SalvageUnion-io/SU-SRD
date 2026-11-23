/** A confirm warns about the starting rules only for a build past them (r2 D4). */

import { describe, expect, test } from 'bun:test'
import { bookPattern, mechFromBookPattern } from '../bookPatterns'
import { mechFromPattern, pastStartingRules } from '../patterns'

describe('pastStartingRules', () => {
  test('a Tech 1 chassis with a light Tech 1 loadout is within them', () => {
    expect(pastStartingRules({ chassisRef: 'mule', systems: ['escape-hatch'], modules: [] })).toBe(
      false
    )
  })

  test('a chassis above Tech 1 is past them', () => {
    expect(pastStartingRules({ chassisRef: 'magpie', systems: [], modules: [] })).toBe(true)
  })

  test('more slots than the chassis has is past them', () => {
    expect(
      pastStartingRules({
        chassisRef: 'mule',
        systems: Array.from({ length: 30 }, () => 'escape-hatch'),
        modules: [],
      })
    ).toBe(true)
  })
})

describe('mechFromPattern', () => {
  test('names the Mech for its pattern, numbered from 1 (r7 G5)', () => {
    const pattern = {
      id: 'p1',
      schemaVersion: 1 as const,
      name: 'Leaky Hauler',
      chassisRef: 'mule',
      systems: [],
      modules: [],
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    expect(mechFromPattern(pattern).name).toBe('Leaky Hauler 1')
    expect(mechFromPattern(pattern, ['Leaky Hauler 1', 'Leaky Hauler 2']).name).toBe(
      'Leaky Hauler 3'
    )
    // A gap is filled; the bare pattern name in the bay is never taken.
    expect(mechFromPattern(pattern, ['Leaky Hauler', 'Leaky Hauler 2']).name).toBe('Leaky Hauler 1')
  })
})

describe('mechFromBookPattern', () => {
  test('names the Mech for its pattern, numbered from 1 (r7 G5)', () => {
    const book = bookPattern('magpie', 'stefanus')
    if (!book) throw new Error('the book prints Stefanus')
    expect(mechFromBookPattern(book.chassis, book.pattern).name).toBe('Stefanus 1')
    expect(mechFromBookPattern(book.chassis, book.pattern, ['Stefanus 1']).name).toBe('Stefanus 2')
  })
})
