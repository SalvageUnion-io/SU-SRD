import { describe, expect, test } from 'bun:test'
import { heatDangerFrom } from '../heatLevel'

describe('heatDangerFrom', () => {
  test('first danger pip index sits at the ~70% line', () => {
    expect(heatDangerFrom(10)).toBe(6) // pips 7..10 red once lit
    expect(heatDangerFrom(8)).toBe(5) // ceil(5.6) - 1
    expect(heatDangerFrom(5)).toBe(3)
    expect(heatDangerFrom(1)).toBe(0)
  })

  test('a red pip is lit exactly when heat crosses the ~70% line', () => {
    for (let max = 1; max <= 20; max++) {
      for (let value = 0; value <= max; value++) {
        const redLit = value > heatDangerFrom(max)
        const escalated = value >= max || value / max >= 0.7
        expect(redLit).toBe(escalated)
      }
    }
  })
})
