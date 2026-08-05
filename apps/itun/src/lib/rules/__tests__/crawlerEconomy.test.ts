/**
 * Unit tests for crawlerEconomy.ts — Upkeep, Deterioration, Upgrade quotes,
 * fixed-rate Scrap exchange, and the Trading Bay availability roll
 * (design-review R-4; Core Book p.218-223).
 *
 * Upgrade-cost tests use REAL data from salvageunion-reference
 * (crawler-tech-levels.json); everything else is pure arithmetic on
 * hand-crafted pools. The d20 / random-Bay pick is injected.
 */
import { describe, expect, it } from 'bun:test'
import type { ScrapPool } from '../../schemas/crawler'
import {
  bayGate,
  contributeToUpgradePool,
  convertedCount,
  convertScrap,
  crawlerUpgradeQuote,
  DETERIORATION_SP_LOSS,
  deteriorationOutcome,
  drawFromPool,
  exchangeStep,
  payUpkeep,
  performDeterioration,
  performTradingRoll,
  poolAvailableAtOrAbove,
  tradingAvailability,
  tradingSourceTl,
  UPKEEP_SCRAP,
  upkeepShortfall,
} from '../crawlerEconomy'
import type { Roll } from '../heatCheck'

/** Returns a Roll that yields the given values in order, ignoring `sides`. */
function seqRoll(...values: number[]): Roll {
  let i = 0
  return () => {
    const v = values[i] ?? values[values.length - 1] ?? 1
    i++
    return v
  }
}

// ---------------------------------------------------------------------------
// Pool draws
// ---------------------------------------------------------------------------

describe('poolAvailableAtOrAbove', () => {
  it('sums the TL bucket and every higher bucket', () => {
    const pool: ScrapPool = { tl1: 9, tl2: 2, tl3: 1, tl5: 4 }
    expect(poolAvailableAtOrAbove(pool, 2)).toBe(7)
    expect(poolAvailableAtOrAbove(pool, 1)).toBe(16)
    expect(poolAvailableAtOrAbove(pool, 6)).toBe(0)
  })
})

describe('drawFromPool', () => {
  it('draws entirely from the exact-TL bucket when it covers', () => {
    const result = drawFromPool({ tl2: 6, tl3: 3 }, 2, 5)
    expect(result).not.toBeNull()
    expect(result?.pool).toEqual({ tl2: 1, tl3: 3 })
    expect(result?.draws).toEqual([{ tl: 2, count: 5 }])
  })

  it('spills into higher buckets, lowest first, never lower ones', () => {
    const result = drawFromPool({ tl1: 99, tl2: 2, tl3: 2, tl4: 5 }, 2, 5)
    expect(result).not.toBeNull()
    expect(result?.pool).toEqual({ tl1: 99, tl2: 0, tl3: 0, tl4: 4 })
    expect(result?.draws).toEqual([
      { tl: 2, count: 2 },
      { tl: 3, count: 2 },
      { tl: 4, count: 1 },
    ])
  })

  it('returns null (no partial draw) when the pool cannot cover', () => {
    const pool: ScrapPool = { tl1: 99, tl3: 4 }
    expect(drawFromPool(pool, 3, 5)).toBeNull()
  })

  it('treats a non-positive amount as a no-op draw', () => {
    const pool: ScrapPool = { tl2: 1 }
    expect(drawFromPool(pool, 2, 0)).toEqual({ pool, draws: [] })
  })

  // The bay-repair convention (S12): a short pool still pays what it has, and
  // the repair goes through regardless. Without `partial` these three cases
  // would refuse, which is why the option had to exist before CrawlerSheet's
  // hand-rolled drain loop could be replaced by this function.
  describe('{ partial: true }', () => {
    it('spends what the qualifying buckets hold instead of refusing', () => {
      const result = drawFromPool({ tl1: 99, tl3: 4 }, 3, 5, { partial: true })
      expect(result.pool).toEqual({ tl1: 99, tl3: 0 })
      expect(result.draws).toEqual([{ tl: 3, count: 4 }])
    })

    it('draws nothing from an empty pool but still returns a result', () => {
      const result = drawFromPool({}, 2, 5, { partial: true })
      expect(result.pool).toEqual({})
      expect(result.draws).toEqual([])
    })

    it('ignores buckets below the requested tech level', () => {
      const result = drawFromPool({ tl1: 99 }, 4, 5, { partial: true })
      expect(result.pool).toEqual({ tl1: 99 })
      expect(result.draws).toEqual([])
    })

    it('behaves identically to the all-or-nothing draw when the pool covers', () => {
      const pool: ScrapPool = { tl2: 2, tl3: 2, tl4: 5 }
      expect(drawFromPool(pool, 2, 5, { partial: true })).toEqual(
        drawFromPool(pool, 2, 5) as { pool: ScrapPool; draws: { tl: number; count: number }[] }
      )
    })
  })
})

// ---------------------------------------------------------------------------
// Upkeep (p.218)
// ---------------------------------------------------------------------------

describe('payUpkeep', () => {
  it('draws 5 TL scrap and credits the Upgrade Pool in full', () => {
    const payment = payUpkeep({ tl3: 7 }, 3)
    expect(payment).not.toBeNull()
    expect(payment?.pool).toEqual({ tl3: 2 })
    expect(payment?.upgradeCredit).toBe(UPKEEP_SCRAP)
  })

  it('accepts higher-TL scrap when the exact bucket is short', () => {
    const payment = payUpkeep({ tl2: 3, tl4: 2 }, 2)
    expect(payment?.pool).toEqual({ tl2: 0, tl4: 0 })
    expect(payment?.draws).toEqual([
      { tl: 2, count: 3 },
      { tl: 4, count: 2 },
    ])
  })

  it('returns null when the pool cannot cover — lower-TL scrap never counts', () => {
    expect(payUpkeep({ tl1: 50, tl3: 4 }, 3)).toBeNull()
  })
})

describe('upkeepShortfall', () => {
  it('is 0 when covered and the missing amount when short', () => {
    expect(upkeepShortfall({ tl2: 5 }, 2)).toBe(0)
    expect(upkeepShortfall({ tl2: 3, tl5: 1 }, 2)).toBe(1)
    expect(upkeepShortfall({}, 2)).toBe(UPKEEP_SCRAP)
  })
})

describe('contributeToUpgradePool', () => {
  it('draws the contribution from TL-or-higher buckets', () => {
    const result = contributeToUpgradePool({ tl2: 2, tl3: 2 }, 2, 3)
    expect(result?.pool).toEqual({ tl2: 0, tl3: 1 })
  })

  it('rejects non-positive and unaffordable contributions', () => {
    expect(contributeToUpgradePool({ tl2: 2 }, 2, 0)).toBeNull()
    expect(contributeToUpgradePool({ tl2: 2 }, 2, 3)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Deterioration Table (p.219)
// ---------------------------------------------------------------------------

describe('deteriorationOutcome', () => {
  it('maps every d20 band per the table', () => {
    expect(deteriorationOutcome(1)).toBe('sp-and-random-bay')
    expect(deteriorationOutcome(2)).toBe('random-bay')
    expect(deteriorationOutcome(5)).toBe('random-bay')
    expect(deteriorationOutcome(6)).toBe('choose-bay')
    expect(deteriorationOutcome(10)).toBe('choose-bay')
    expect(deteriorationOutcome(11)).toBe('lose-sp')
    expect(deteriorationOutcome(19)).toBe('lose-sp')
    expect(deteriorationOutcome(20)).toBe('safe')
  })
})

describe('performDeterioration', () => {
  it('20: no effect at all', () => {
    const effect = performDeterioration({ currentSP: 12, bayCount: 8, roll: seqRoll(20) })
    expect(effect.outcome).toBe('safe')
    expect(effect.spLoss).toBe(0)
    expect(effect.nextSP).toBe(12)
    expect(effect.randomBayIndex).toBeNull()
    expect(effect.requiresPlayerChoice).toBe(false)
  })

  it('11-19: loses 5 SP, floored at 0', () => {
    const effect = performDeterioration({ currentSP: 3, bayCount: 8, roll: seqRoll(15) })
    expect(effect.outcome).toBe('lose-sp')
    expect(effect.spLoss).toBe(DETERIORATION_SP_LOSS)
    expect(effect.nextSP).toBe(0)
    expect(effect.randomBayIndex).toBeNull()
  })

  it('6-10: raises the player-choice flag and touches nothing', () => {
    const effect = performDeterioration({ currentSP: 12, bayCount: 8, roll: seqRoll(7) })
    expect(effect.outcome).toBe('choose-bay')
    expect(effect.requiresPlayerChoice).toBe(true)
    expect(effect.spLoss).toBe(0)
    expect(effect.randomBayIndex).toBeNull()
  })

  it('2-5: auto-picks a random Bay index via the injected roller', () => {
    const effect = performDeterioration({ currentSP: 12, bayCount: 8, roll: seqRoll(4, 6) })
    expect(effect.outcome).toBe('random-bay')
    expect(effect.randomBayIndex).toBe(5) // roll(8) = 6 → index 5
    expect(effect.spLoss).toBe(0)
  })

  it('1: loses 5 SP AND damages a random Bay', () => {
    const effect = performDeterioration({ currentSP: 12, bayCount: 3, roll: seqRoll(1, 1) })
    expect(effect.outcome).toBe('sp-and-random-bay')
    expect(effect.spLoss).toBe(DETERIORATION_SP_LOSS)
    expect(effect.nextSP).toBe(7)
    expect(effect.randomBayIndex).toBe(0)
  })

  it('random-Bay bands with zero bays pick nothing', () => {
    const effect = performDeterioration({ currentSP: 12, bayCount: 0, roll: seqRoll(3) })
    expect(effect.randomBayIndex).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Upgrade quote (real crawler-tech-levels data)
// ---------------------------------------------------------------------------

describe('crawlerUpgradeQuote', () => {
  it('quotes the next sequential upgrade at the data-defined cost (30)', () => {
    const quote = crawlerUpgradeQuote(2, 30)
    expect(quote).not.toBeNull()
    expect(quote?.fromTl).toBe(2)
    expect(quote?.toTl).toBe(3)
    expect(quote?.cost).toBe(30)
    expect(quote?.affordable).toBe(true)
    expect(quote?.remainingPool).toBe(0)
  })

  it('flags an underfunded pool as unaffordable', () => {
    const quote = crawlerUpgradeQuote(1, 29)
    expect(quote?.affordable).toBe(false)
    expect(quote?.remainingPool).toBe(0)
  })

  it('banks any surplus above the cost', () => {
    expect(crawlerUpgradeQuote(1, 42)?.remainingPool).toBe(12)
  })

  it('returns null at Tech 6 (no further upgrade) and out-of-range TLs', () => {
    expect(crawlerUpgradeQuote(6, 999)).toBeNull()
    expect(crawlerUpgradeQuote(0, 999)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Fixed-rate Scrap exchange (p.223)
// ---------------------------------------------------------------------------

describe('convertedCount', () => {
  it('converts at exact equal value: 4× T1 → 1× T4', () => {
    expect(convertedCount(1, 4, 4)).toBe(1)
  })

  it('converts down as well: 1× T4 → 4× T1, 2× T3 → 3× T2', () => {
    expect(convertedCount(4, 1, 1)).toBe(4)
    expect(convertedCount(3, 2, 2)).toBe(3)
  })

  it('rejects inexact exchanges — the Trading Bay never makes change', () => {
    expect(convertedCount(1, 3, 4)).toBeNull() // value 3 ≠ k×4
    expect(convertedCount(4, 1, 3)).toBeNull() // value 4 ≠ k×3
  })

  it('rejects degenerate inputs (same TL, zero count, TL out of range)', () => {
    expect(convertedCount(2, 4, 2)).toBeNull()
    expect(convertedCount(1, 0, 4)).toBeNull()
    expect(convertedCount(7, 7, 1)).toBeNull()
  })
})

describe('exchangeStep', () => {
  it('is the smallest exact from-count: T2→T3 steps by 3, T1→T4 by 4, T2→T4 by 2', () => {
    expect(exchangeStep(2, 3)).toBe(3)
    expect(exchangeStep(1, 4)).toBe(4)
    expect(exchangeStep(2, 4)).toBe(2)
    expect(exchangeStep(4, 2)).toBe(1)
  })
})

describe('convertScrap', () => {
  it('moves value between buckets at the fixed rate', () => {
    const result = convertScrap({ tl1: 5, tl4: 1 }, 1, 4, 4)
    expect(result?.toCount).toBe(1)
    expect(result?.pool).toEqual({ tl1: 1, tl4: 2 })
  })

  it('returns null when the from-bucket is short or the rate is inexact', () => {
    expect(convertScrap({ tl1: 3 }, 1, 4, 4)).toBeNull()
    expect(convertScrap({ tl1: 3 }, 1, 3, 4)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Trading Bay availability roll (p.223)
// ---------------------------------------------------------------------------

describe('tradingAvailability', () => {
  it('maps every d20 band per the Trading Bay Table', () => {
    expect(tradingAvailability(1)).toBe('nothing')
    expect(tradingAvailability(2)).toBe('module')
    expect(tradingAvailability(5)).toBe('module')
    expect(tradingAvailability(6)).toBe('system')
    expect(tradingAvailability(10)).toBe('system')
    expect(tradingAvailability(11)).toBe('system-and-module')
    expect(tradingAvailability(19)).toBe('system-and-module')
    expect(tradingAvailability(20)).toBe('chassis')
  })
})

describe('tradingSourceTl', () => {
  it('is one Tech Level above the crawler, capped at 6', () => {
    expect(tradingSourceTl(1)).toBe(2)
    expect(tradingSourceTl(5)).toBe(6)
    expect(tradingSourceTl(6)).toBe(6)
  })
})

describe('performTradingRoll', () => {
  it('bundles the roll, its band, and the source TL', () => {
    const result = performTradingRoll({ crawlerTl: 2, roll: seqRoll(20) })
    expect(result).toEqual({ roll: 20, availability: 'chassis', sourceTl: 3 })
  })
})

// ---------------------------------------------------------------------------
// Bay gate (real crawler-bays data)
// ---------------------------------------------------------------------------

describe('bayGate', () => {
  it('resolves presence + condition of a named bay by ref', () => {
    const crawler = {
      crawlerBays: [
        { bayRef: 'Trading Bay' },
        { bayRef: 'Med Bay', condition: 'damaged' as const },
      ],
    }
    expect(bayGate(crawler, 'Trading Bay')).toEqual({
      present: true,
      damaged: false,
      operational: true,
    })
    expect(bayGate(crawler, 'Med Bay')).toEqual({
      present: true,
      damaged: true,
      operational: false,
    })
    expect(bayGate(crawler, 'Crafting Bay')).toEqual({
      present: false,
      damaged: false,
      operational: false,
    })
  })

  it('a damaged Trading Bay is present but not operational', () => {
    const crawler = { crawlerBays: [{ bayRef: 'Trading Bay', condition: 'damaged' as const }] }
    expect(bayGate(crawler, 'Trading Bay').operational).toBe(false)
  })
})
