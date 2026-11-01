/**
 * Bay repair: 5 Scrap of the crawler's Tech Level or higher,
 * drawn lowest bucket first; a short pool still repairs and only names the
 * shortfall.
 */

import { describe, expect, test } from 'bun:test'
import { poolShortfall } from '../crawlerEconomy'
import { BAY_REPAIR_COST, bayRepairPatch } from '../crawlerItems'

describe('poolShortfall for a bay repair', () => {
  test('0 when the TL-or-higher buckets cover the cost', () => {
    expect(poolShortfall({ tl2: 3, tl3: 2 }, 2, BAY_REPAIR_COST)).toBe(0)
  })

  test('lower-TL scrap does not count', () => {
    expect(poolShortfall({ tl1: 9, tl2: 1 }, 2, BAY_REPAIR_COST)).toBe(BAY_REPAIR_COST - 1)
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
