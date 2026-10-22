/**
 * NESTING LEVEL (N1, EDL E6): a Page is level 0, so what it nests is level 1,
 * compact Cards; every other host is level 1 or deeper, so what it nests is
 * level 2, and level 2 holds Minis only.
 */
import { describe, expect, test } from 'bun:test'
import { nestsMinis } from '../nestingLevel'

describe('nestsMinis', () => {
  test('a Page nests cards', () => {
    expect(nestsMinis({ onPage: true })).toBe(false)
  })

  test('any other host nests Minis', () => {
    expect(nestsMinis({ onPage: false })).toBe(true)
    expect(nestsMinis({})).toBe(true)
  })
})
