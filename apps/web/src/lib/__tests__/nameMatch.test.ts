import { describe, expect, test } from 'bun:test'
import { nameMatches } from '../nameMatch'

describe('nameMatches: a name filter forgives one slip (r4 E14)', () => {
  test('a literal part of the name matches, as before', () => {
    expect(nameMatches('Red Laser', 'las')).toBe(true)
    expect(nameMatches('Red Laser', 'red laser')).toBe(true)
    expect(nameMatches('Red Laser', '')).toBe(true)
  })

  test('one slip in a word of four letters or more still finds it', () => {
    expect(nameMatches('Red Laser', 'lazer')).toBe(true)
    expect(nameMatches('Railgun', 'ralgun')).toBe(true)
    expect(nameMatches('Wader', 'waderr')).toBe(true)
  })

  test('another name does not match', () => {
    expect(nameMatches('Rail Rifle', 'lazer')).toBe(false)
    expect(nameMatches('Atlas', 'xyz')).toBe(false)
  })
})
