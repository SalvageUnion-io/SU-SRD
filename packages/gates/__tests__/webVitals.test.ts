import { describe, expect, test } from 'bun:test'
import {
  cumulativeLayoutShift,
  median,
  medianVitals,
  overBudget,
  totalBlockingTime,
  vitalsTable,
} from '../lib/webVitals'

describe('totalBlockingTime', () => {
  test('counts each task past 50 ms after FCP', () => {
    expect(
      totalBlockingTime(
        [
          { startTime: 1_000, duration: 120 },
          { startTime: 2_000, duration: 40 },
        ],
        500
      )
    ).toBe(70)
  })

  test('ignores tasks that end before FCP and clips one straddling it', () => {
    expect(
      totalBlockingTime(
        [
          { startTime: 0, duration: 300 },
          { startTime: 400, duration: 300 },
        ],
        500
      )
    ).toBe(150)
  })
})

describe('cumulativeLayoutShift', () => {
  test('takes the largest session window, skipping shifts after input', () => {
    const shifts = [
      { startTime: 3_000, value: 0.05, hadRecentInput: false },
      { startTime: 100, value: 0.02, hadRecentInput: false },
      { startTime: 600, value: 0.01, hadRecentInput: false },
      { startTime: 3_500, value: 0.5, hadRecentInput: true },
      { startTime: 3_400, value: 0.01, hadRecentInput: false },
    ]
    expect(cumulativeLayoutShift(shifts)).toBeCloseTo(0.06)
  })

  test('closes a window after 5 s even without a gap', () => {
    const shifts = Array.from({ length: 12 }, (_, i) => ({
      startTime: i * 900,
      value: 0.01,
      hadRecentInput: false,
    }))
    expect(cumulativeLayoutShift(shifts)).toBeCloseTo(0.06)
  })

  test('is zero with no shifts', () => {
    expect(cumulativeLayoutShift([])).toBe(0)
  })
})

describe('median', () => {
  test('odd and even counts', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })

  test('refuses an empty list', () => {
    expect(() => median([])).toThrow('median of no values')
  })

  test('per metric across runs', () => {
    expect(
      medianVitals([
        { lcp: 2_000, tbt: 0, cls: 0.1 },
        { lcp: 9_000, tbt: 10, cls: 0 },
        { lcp: 2_100, tbt: 500, cls: 0 },
      ])
    ).toEqual({ lcp: 2_100, tbt: 10, cls: 0 })
  })
})

describe('overBudget', () => {
  const budget = { lcp: 3_000, tbt: 200, cls: 0.1 }

  test('is empty within budget', () => {
    expect(overBudget('/', { lcp: 3_000, tbt: 200, cls: 0.1 }, budget)).toEqual([])
  })

  test('names every metric over its budget', () => {
    expect(overBudget('/', { lcp: 3_100.4, tbt: 250, cls: 0.12 }, budget)).toEqual([
      '/: LCP 3100 ms is over its 3000 ms budget',
      '/: TBT 250 ms is over its 200 ms budget',
      '/: CLS 0.120 is over its 0.1 budget',
    ])
  })
})

test('vitalsTable marks the metrics over budget', () => {
  const table = vitalsTable([
    {
      page: '/',
      measured: { lcp: 3_100, tbt: 20, cls: 0 },
      budget: { lcp: 3_000, tbt: 200, cls: 0.1 },
    },
  ])
  expect(table.split('\n')).toEqual([
    '| Page | LCP (budget) | TBT (budget) | CLS (budget) |',
    '| --- | --- | --- | --- |',
    '| / | ❌ 3100 ms (3000) | 20 ms (200) | 0.000 (0.1) |',
  ])
})
