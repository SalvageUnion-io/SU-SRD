import { describe, expect, test } from 'bun:test'
import { occurrenceKeys } from '../occurrenceKeys'

describe('occurrenceKeys', () => {
  test('unique values key by value alone', () => {
    expect(occurrenceKeys(['a', 'b', 'c'])).toEqual(['a#0', 'b#0', 'c#0'])
  })

  test('repeats are numbered by occurrence, so every key is unique', () => {
    const keys = occurrenceKeys(['laser', 'shield', 'laser', 'laser'])
    expect(keys).toEqual(['laser#0', 'shield#0', 'laser#1', 'laser#2'])
    expect(new Set(keys).size).toBe(keys.length)
  })

  test('removing an item leaves every other item with the key it had', () => {
    // The point of the helper: an index key would renumber 'shield' and 'drill'.
    const before = occurrenceKeys(['laser', 'shield', 'drill'])
    const after = occurrenceKeys(['shield', 'drill'])
    expect(after).toEqual(before.slice(1))
  })

  test('empty input yields no keys', () => {
    expect(occurrenceKeys([])).toEqual([])
  })
})
