import { describe, expect, test } from 'bun:test'
import { truncate } from './truncate.js'

describe('truncate', () => {
  test('passes text at or under the cap through unchanged', () => {
    expect(truncate('short', 100)).toBe('short')
    expect(truncate('exactly', 7)).toBe('exactly')
  })

  test('caps long text, ellipsis included', () => {
    const long = 'word '.repeat(100)
    expect(truncate(long, 50).length).toBeLessThanOrEqual(50)
    expect(truncate(long, 50).endsWith('…')).toBe(true)
  })

  test('cuts at a word boundary, never mid-word', () => {
    expect(truncate('The quick brown fox jumps over the lazy dog', 20)).toBe('The quick brown…')
  })

  test('cuts mid-word only when no boundary falls late enough', () => {
    expect(truncate('a supercalifragilistic', 10)).toBe('a superca…')
  })

  test('returns an empty string for a non-positive cap', () => {
    expect(truncate('anything', 0)).toBe('')
  })
})
