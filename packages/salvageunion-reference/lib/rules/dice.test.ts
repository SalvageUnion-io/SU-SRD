import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { rollDie } from './dice.js'

/** Make `crypto.getRandomValues` hand out these 32-bit draws, in order. */
function stubDraws(...draws: number[]) {
  return spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
    const next = draws.shift()
    if (next === undefined) throw new Error('draw queue exhausted')
    ;(array as unknown as Uint32Array)[0] = next
    return array
  })
}

describe('rollDie', () => {
  afterEach(() => {
    mock.restore()
  })

  test.each([1, 2, 3, 6, 20, 100])('d%i always lands on a whole face from 1 to sides', (sides) => {
    for (let i = 0; i < 2000; i++) {
      const face = rollDie(sides)
      expect(Number.isInteger(face)).toBe(true)
      expect(face).toBeGreaterThanOrEqual(1)
      expect(face).toBeLessThanOrEqual(sides)
    }
  })

  test('a d20 reaches both of its bounds and every face between', () => {
    const seen = new Set<number>()
    // Missing any one face in 2000 fair draws has probability ~20 * 0.95^2000.
    for (let i = 0; i < 2000; i++) seen.add(rollDie(20))
    expect([...seen].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
  })

  test('the lowest and highest accepted draws map to faces 1 and sides', () => {
    // 2^32 % 20 === 16, so the largest accepted draw is 2^32 - 17.
    stubDraws(0, 2 ** 32 - 17)
    expect(rollDie(20)).toBe(1)
    expect(rollDie(20)).toBe(20)
  })

  test('draws in the biased tail are rejected and redrawn', () => {
    // 2^32 - 16 .. 2^32 - 1 would over-weight faces 1-16; each is redrawn.
    const spy = stubDraws(2 ** 32 - 16, 2 ** 32 - 1, 41)
    expect(rollDie(20)).toBe(2)
    expect(spy).toHaveBeenCalledTimes(3)
  })

  test.each([0, -1, 2.5, Number.NaN, 2 ** 32 + 1])('rejects %p sides', (sides) => {
    expect(() => rollDie(sides)).toThrow(RangeError)
  })
})
