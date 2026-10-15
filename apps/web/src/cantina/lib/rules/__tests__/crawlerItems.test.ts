/**
 * Bay repair: 5 Scrap of the crawler's Tech Level or higher,
 * drawn lowest bucket first; a short pool still repairs and only names the
 * shortfall.
 */

import { describe, expect, test } from 'bun:test'
import { BAY_REPAIR_COST, bayRepairPatch, bayRepairShortfall, bayTechLines } from '../crawlerItems'

describe('bayRepairShortfall', () => {
  test('0 when the TL-or-higher buckets cover the cost', () => {
    expect(bayRepairShortfall({ tl2: 3, tl3: 2 }, 2)).toBe(0)
  })

  test('lower-TL scrap does not count', () => {
    expect(bayRepairShortfall({ tl1: 9, tl2: 1 }, 2)).toBe(BAY_REPAIR_COST - 1)
  })
})

describe('bayRepairPatch', () => {
  test('draws from the crawler-TL bucket up and flips the bay Intact', () => {
    const { crawlerPatch, bayPatch } = bayRepairPatch({ tl1: 4, tl2: 3, tl3: 4 }, 2)
    expect(crawlerPatch.scrapPool).toMatchObject({ tl1: 4, tl2: 0, tl3: 2 })
    expect(bayPatch).toEqual({ condition: 'intact' })
  })

  test('a short pool spends what it has and the bay still repairs', () => {
    const { crawlerPatch, bayPatch } = bayRepairPatch({ tl2: 2 }, 2)
    expect(crawlerPatch.scrapPool).toMatchObject({ tl2: 0 })
    expect(bayPatch).toEqual({ condition: 'intact' })
  })
})

describe('bayTechLines', () => {
  const ladder = [
    { type: 'paragraph', value: 'A Med Bay allows Pilots to heal their injuries.' },
    { type: 'list-item', label: 'Tech 1-2', value: 'Heals a Pilot to full Hit Points.' },
    { type: 'list-item', label: 'Tech 3-4', value: 'And Minor Injuries.' },
    { type: 'list-item', label: 'Tech 5-6', value: 'And Major Injuries.' },
  ]

  test('keeps only the rung the crawler stands on', () => {
    expect(bayTechLines(ladder, 3).map((b) => b.label)).toEqual(['Tech 3-4'])
    expect(bayTechLines(ladder, 6).map((b) => b.label)).toEqual(['Tech 5-6'])
  })

  test('a bay with no ladder has no line', () => {
    const prose: { type: string; value: string; label?: string }[] = [
      { type: 'paragraph', value: 'Prose.' },
    ]
    expect(bayTechLines(prose, 2)).toEqual([])
  })
})
