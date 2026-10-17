/**
 * NESTING LEVEL (N1, EDL E6): a Page is level 0, so what it nests is level 1,
 * compact Cards; every other host is level 1 or deeper, so what it nests is
 * level 2, and level 2 holds Tokens only.
 */
import { describe, expect, test } from 'bun:test'
import { nestsTokens } from '../nestingLevel'

describe('nestsTokens', () => {
  test('a Page nests cards', () => {
    expect(nestsTokens({ onPage: true })).toBe(false)
  })

  test('any other host nests Tokens', () => {
    expect(nestsTokens({ onPage: false })).toBe(true)
    expect(nestsTokens({})).toBe(true)
  })
})
