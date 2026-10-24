/**
 * Unit tests for exoticSalvage.ts: trading, processing and paying with
 * Bio-Salvage, Chimerium and Meld Nanites (Core Book p.275, p.288; We Were
 * Here First! pp.9-10, p.61; False Flag p.66).
 */
import { describe, expect, it } from 'bun:test'
import type { ScrapPool } from 'game-domain/schemas/crawler'
import { craftBaysOf, craftQuote } from '../crafting'
import {
  addToExotic,
  bioAvailable,
  drawActiveNanites,
  drawBio,
  exoticBucket,
  hasExotic,
  naniteProcessingGate,
  processNanites,
  tradeExotic,
} from '../exoticSalvage'

/** A d20 that rolls `rolls` in turn. */
const dice = (...rolls: number[]) => {
  let i = 0
  return () => rolls[i++] ?? 1
}

describe('buckets', () => {
  it('reads an absent resource as 0 and floors a spend at 0', () => {
    expect(exoticBucket({}, 'bio')).toBe(0)
    expect(addToExotic({ bio: 2 }, 'bio', -5)).toEqual({ bio: 0 })
    expect(hasExotic({ tl1: 4 })).toBe(false)
    expect(hasExotic({ chimerium: 1 })).toBe(true)
  })
})

describe('tradeExotic', () => {
  it('trades Bio-Salvage and Inert Meld Nanites for Tech 1 Scrap, one each', () => {
    expect(tradeExotic({ bio: 3, tl1: 1 }, 'bio', 2)).toEqual({
      pool: { bio: 1, tl1: 3 },
      tl: 1,
      scrap: 2,
    })
    expect(tradeExotic({ inertNanites: 1 }, 'inertNanites', 1)?.pool).toEqual({
      inertNanites: 0,
      tl1: 1,
    })
  })

  it('trades Chimerium and Active Meld Nanites as Tech 6 Scrap', () => {
    expect(tradeExotic({ chimerium: 2 }, 'chimerium', 2)?.pool).toEqual({ chimerium: 0, tl6: 2 })
    expect(tradeExotic({ activeNanites: 1 }, 'activeNanites', 1)?.tl).toBe(6)
  })

  it('refuses a short bucket or a count that is not a positive whole number', () => {
    expect(tradeExotic({ bio: 1 }, 'bio', 2)).toBeNull()
    expect(tradeExotic({ bio: 1 }, 'bio', 0)).toBeNull()
    expect(tradeExotic({ bio: 3 }, 'bio', 1.5)).toBeNull()
  })
})

describe('processNanites (False Flag p.66)', () => {
  it('rolls a d20 a pile, spends every pile, and a 20 is an Active Meld Nanite', () => {
    const result = processNanites({ inertNanites: 3, activeNanites: 1 }, dice(20, 7, 20))
    expect(result.processed).toBe(3)
    expect(result.rolls).toEqual([20, 7, 20])
    expect(result.found).toBe(2)
    expect(result.pool).toEqual({ inertNanites: 0, activeNanites: 3 })
  })

  it('processes nothing with no piles', () => {
    const result = processNanites({}, dice())
    expect(result).toEqual({
      processed: 0,
      found: 0,
      rolls: [],
      pool: { inertNanites: 0, activeNanites: 0 },
    })
  })

  it('needs an Intact Nanite Processing Bay', () => {
    expect(naniteProcessingGate({ crawlerBays: [] }).present).toBe(false)
    const damaged = {
      crawlerBays: [{ bayRef: 'nanite-processing-bay', condition: 'damaged' as const }],
    }
    expect(naniteProcessingGate(damaged)).toEqual({
      present: true,
      damaged: true,
      operational: false,
    })
  })
})

describe('paying for Bio-Tech (WWHF p.61, p.10)', () => {
  it('counts a Chimerium as 10 Bio-Salvage', () => {
    expect(bioAvailable({ bio: 3, chimerium: 2 })).toBe(23)
  })

  it('spends Bio-Salvage first, then whole Chimerium', () => {
    expect(drawBio({ bio: 3, chimerium: 2 }, 5)).toEqual({
      pool: { bio: 0, chimerium: 1 },
      spent: { bio: 3, chimerium: 1 },
    })
    expect(drawBio({ bio: 6 }, 4)).toEqual({ pool: { bio: 2, chimerium: 0 }, spent: { bio: 4 } })
    expect(drawBio({ bio: 1 }, 4)).toBeNull()
  })

  it('pays Nanite-Tech in Active Meld Nanites', () => {
    expect(drawActiveNanites({ activeNanites: 4 }, 3)).toEqual({
      pool: { activeNanites: 1 },
      spent: { activeNanites: 3 },
    })
    expect(drawActiveNanites({ activeNanites: 1, tl6: 9 }, 3)).toBeNull()
  })
})

describe('craftQuote for Bio-Tech and Nanite-Tech', () => {
  const BIO_TALON = { name: 'Bio-Talon', techLevel: 'B' as const, salvageValue: 6 }
  const NANITE_BLADE = { name: 'Nanite Blade', techLevel: 'N' as const, salvageValue: 2 }
  const pool: ScrapPool = { tl6: 20, bio: 2, chimerium: 1, activeNanites: 2 }

  it('crafts Bio-Tech only with a Bio-Crafting Bay, paid in Bio-Salvage', () => {
    const none = craftQuote(BIO_TALON, pool, 6)
    expect(none.eligible).toBe(false)
    const bays = craftBaysOf({ crawlerBays: [{ bayRef: 'bio-crafting-bay' }] })
    const quote = craftQuote(BIO_TALON, pool, 1, bays)
    expect(quote).toMatchObject({ currency: 'bio', cost: 6, eligible: true, affordable: true })
    expect(quote.spent).toEqual({ bio: 2, chimerium: 1 })
    expect(quote.pool).toEqual({ tl6: 20, bio: 0, chimerium: 0, activeNanites: 2 })
  })

  it('never pays Bio-Tech in Scrap', () => {
    const bays = { bioCrafting: true, naniteProcessing: false }
    const quote = craftQuote(BIO_TALON, { tl6: 50 }, 6, bays)
    expect(quote.affordable).toBe(false)
    expect(quote.shortfall).toBe(6)
  })

  it('crafts Nanite-Tech in a Nanite Processing Bay or on a Tech 6 crawler', () => {
    expect(craftQuote(NANITE_BLADE, pool, 5).eligible).toBe(false)
    expect(craftQuote(NANITE_BLADE, pool, 6).eligible).toBe(true)
    const bays = { bioCrafting: false, naniteProcessing: true }
    const quote = craftQuote(NANITE_BLADE, pool, 1, bays)
    expect(quote).toMatchObject({ currency: 'nanites', eligible: true, affordable: true })
    expect(quote.spent).toEqual({ activeNanites: 2 })
  })

  it('a Damaged bay crafts nothing', () => {
    const bays = craftBaysOf({
      crawlerBays: [{ bayRef: 'bio-crafting-bay', condition: 'damaged' }],
    })
    expect(bays.bioCrafting).toBe(false)
  })
})
