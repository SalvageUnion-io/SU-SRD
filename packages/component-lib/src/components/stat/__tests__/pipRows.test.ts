import { describe, test, expect } from 'bun:test'
import { statBlockRows, pipClickValue } from '../pipRows'

describe('statBlockRows — ≤6 per row, extras to LAST rows (ruleset §4.5)', () => {
  test('fits a single row up to 6', () => {
    expect(statBlockRows(1)).toEqual([1])
    expect(statBlockRows(5)).toEqual([5])
    expect(statBlockRows(6)).toEqual([6])
  })

  test('splits evenly with extras to the LAST rows (bottom-heavy, ≤6/row)', () => {
    expect(statBlockRows(7)).toEqual([3, 4])
    expect(statBlockRows(8)).toEqual([4, 4])
    expect(statBlockRows(9)).toEqual([4, 5])
    expect(statBlockRows(10)).toEqual([5, 5])
    expect(statBlockRows(11)).toEqual([5, 6])
    expect(statBlockRows(12)).toEqual([6, 6])
    // The awkward-split case: the heavy row of 5 sits on the bottom.
    expect(statBlockRows(13)).toEqual([4, 4, 5])
    expect(statBlockRows(20)).toEqual([5, 5, 5, 5])
  })

  test('returns [] for non-positive counts', () => {
    expect(statBlockRows(0)).toEqual([])
    expect(statBlockRows(-3)).toEqual([])
  })
})

describe('pipClickValue — click-to-set semantics (design §4.5)', () => {
  test('clicking a lit pip turns it and everything above off', () => {
    // value 5, click pip index 2 (lit) → value 2
    expect(pipClickValue(2, 5)).toBe(2)
  })

  test('clicking an unlit pip fills up to and including it', () => {
    // value 2, click pip index 4 (unlit) → value 5
    expect(pipClickValue(4, 2)).toBe(5)
  })

  test('clicking the top lit pip decrements by one', () => {
    expect(pipClickValue(4, 5)).toBe(4)
  })

  test('clicking the next unlit pip increments by one', () => {
    expect(pipClickValue(5, 5)).toBe(6)
  })
})
