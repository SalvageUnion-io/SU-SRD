/**
 * The concrete `Roll` binding: the one source of real randomness in this
 * package. Every other rules function takes a `Roll` as a parameter so it stays
 * deterministic in tests; callers pass `rollDie` in production.
 */

const RANGE = 2 ** 32

/**
 * One uniform roll of a die with `sides` faces, from 1 to `sides` inclusive.
 *
 * Draws 32 bits from `crypto.getRandomValues` and redraws any value at or above
 * the largest multiple of `sides`, so `% sides` cannot favour the low faces.
 */
export function rollDie(sides: number): number {
  if (!Number.isInteger(sides) || sides < 1 || sides > RANGE) {
    throw new RangeError(`rollDie: sides must be an integer from 1 to 2^32, got ${sides}`)
  }
  const limit = RANGE - (RANGE % sides)
  const draw = new Uint32Array(1)
  let value: number
  do {
    crypto.getRandomValues(draw)
    value = draw[0] as number
  } while (value >= limit)
  return (value % sides) + 1
}
