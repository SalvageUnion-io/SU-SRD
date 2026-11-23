/** A shelf's Select (r6 E3): a click checks one line, shift-click the range from the last. */
import { describe, expect, test } from 'bun:test'
import { rangeOf } from '../ShelfSelect'

const ORDER = ['a', 'b', 'c', 'd', 'e']

describe('rangeOf', () => {
  test('a click is its own line', () => {
    expect(rangeOf(ORDER, 'a', 'd', false)).toEqual(['d'])
  })
  test('shift-click takes the range from the last line clicked, either way', () => {
    expect(rangeOf(ORDER, 'b', 'd', true)).toEqual(['b', 'c', 'd'])
    expect(rangeOf(ORDER, 'e', 'c', true)).toEqual(['c', 'd', 'e'])
  })
  test('with no last line, or one no longer shown, shift-click is one line', () => {
    expect(rangeOf(ORDER, undefined, 'c', true)).toEqual(['c'])
    expect(rangeOf(ORDER, 'gone', 'c', true)).toEqual(['c'])
  })
})
