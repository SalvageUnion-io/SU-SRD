import { describe, test, expect } from 'bun:test'
import { heatLevel, heatDangerFrom, HEAT_HIGH_RATIO } from '../heatLevel'

describe('heatLevel', () => {
  test('normal below ~70% of max', () => {
    expect(heatLevel(0, 10)).toBe('normal')
    expect(heatLevel(6, 10)).toBe('normal')
    expect(heatLevel(4, 6)).toBe('normal') // 0.67 < 0.7
  })

  test('high at >= 70% of max, below cap', () => {
    expect(heatLevel(7, 10)).toBe('high')
    expect(heatLevel(9, 10)).toBe('high')
    expect(heatLevel(5, 6)).toBe('high') // 0.83
    expect(heatLevel(4, 5)).toBe('high') // 0.8
  })

  test('critical at (or past) cap', () => {
    expect(heatLevel(10, 10)).toBe('critical')
    expect(heatLevel(11, 10)).toBe('critical')
    expect(heatLevel(1, 1)).toBe('critical')
  })

  test('inert without a positive max (srd static render case)', () => {
    expect(heatLevel(8, undefined)).toBe('normal')
    expect(heatLevel(8, 0)).toBe('normal')
    expect(heatLevel(8, -1)).toBe('normal')
  })
})

describe('heatDangerFrom', () => {
  test('first danger pip index sits at the ~70% line', () => {
    expect(heatDangerFrom(10)).toBe(6) // pips 7..10 red once lit
    expect(heatDangerFrom(8)).toBe(5) // ceil(5.6) - 1
    expect(heatDangerFrom(5)).toBe(3)
    expect(heatDangerFrom(1)).toBe(0)
  })

  test('a red pip is lit exactly when heatLevel escalates', () => {
    for (let max = 1; max <= 20; max++) {
      for (let value = 0; value <= max; value++) {
        const redLit = value > heatDangerFrom(max)
        const escalated = heatLevel(value, max) !== 'normal'
        expect(redLit).toBe(escalated)
      }
    }
  })

  test('ratio constant is the single source of the threshold', () => {
    expect(HEAT_HIGH_RATIO).toBeGreaterThan(0)
    expect(HEAT_HIGH_RATIO).toBeLessThan(1)
  })
})
