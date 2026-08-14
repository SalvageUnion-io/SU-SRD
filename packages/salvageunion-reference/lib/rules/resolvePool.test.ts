import { describe, expect, test } from 'bun:test'
import { resolveGauge, resolvePool } from './derivedStats.js'

/**
 * The two rules these encode look alike and mean opposite things, which is why
 * they are worth one definition each rather than ~40 hand-written copies.
 */
describe('resolvePool — an unset pool means FULL', () => {
  test('undefined resolves to the maximum', () => {
    // The case that matters: a fresh pilot has no stored HP because nothing has
    // damaged them, not because they are at zero.
    expect(resolvePool(undefined, 10)).toBe(10)
    expect(resolvePool(undefined, 0)).toBe(0)
  })

  test('a stored value passes through', () => {
    expect(resolvePool(7, 10)).toBe(7)
    expect(resolvePool(0, 10)).toBe(0)
  })

  test('zero is NOT treated as unset', () => {
    // `?? ` rather than `||` — a downed pilot is at 0, and must stay there.
    expect(resolvePool(0, 10)).toBe(0)
  })

  test('a stored value above the max is clamped down', () => {
    // The max can fall after the value was stored: an injury lowers max HP, a
    // lost system lowers max EP.
    expect(resolvePool(12, 10)).toBe(10)
  })
})

describe('resolveGauge — an unset gauge means EMPTY', () => {
  test('undefined resolves to zero', () => {
    // Heat inverts the default. A mech that has done nothing is cold; defaulting
    // it to capacity would put a fresh mech one roll from Reactor Overload.
    expect(resolveGauge(undefined, 6)).toBe(0)
  })

  test('a stored value passes through and clamps to capacity', () => {
    expect(resolveGauge(3, 6)).toBe(3)
    expect(resolveGauge(9, 6)).toBe(6)
  })

  test('with no max, it defaults without clamping', () => {
    // Reading heat as the starting point for arithmetic — "current heat, plus
    // what this action costs" — must not clamp before the addition.
    expect(resolveGauge(undefined)).toBe(0)
    expect(resolveGauge(9)).toBe(9)
  })
})

describe('the two are opposites', () => {
  test('an unset value differs by the whole range', () => {
    // Stated as an assertion so a refactor that unified them would fail here
    // rather than silently in a sheet.
    expect(resolvePool(undefined, 8)).toBe(8)
    expect(resolveGauge(undefined, 8)).toBe(0)
  })
})
