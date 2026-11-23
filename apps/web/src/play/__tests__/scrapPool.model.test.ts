import { describe, expect, test } from 'bun:test'
import { poolChips, poolText } from '../scrapPool.model'

describe('the Scrap Pool, said (r8 D1, D2)', () => {
  test('by Tech Level, lowest first, empty levels left out', () => {
    expect(poolChips({ tl3: 1, tl1: 4, tl2: 0 })).toEqual([
      { label: 'T1', value: '4' },
      { label: 'T3', value: '1' },
    ])
    expect(poolChips(undefined)).toEqual([])
  })

  test('on one line, or the word for none', () => {
    expect(poolText({ tl1: 3, tl2: 1 }, 'No Scrap')).toBe('T1 3 · T2 1')
    expect(poolText({}, 'No Scrap')).toBe('No Scrap')
  })
})
