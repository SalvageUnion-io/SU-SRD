import { describe, expect, test } from 'bun:test'
import { depositScrap, pilotScrap, scrapCount, scrapMove } from '../tallyScrap'

/** Tally Salvage's Scrap (Core Book p.227, r6 D1). */
describe('scrapMove', () => {
  const pilot = {
    genericInventory: [
      { name: 'Tech 1 Scrap', qty: 2 },
      { name: 'Tech 3 Scrap' },
      { name: 'Tech 9 Scrap', qty: 4 },
      { name: 'Rope' },
    ],
  }

  test('counts a pilot’s Scrap by Tech Level, and nothing that is not Scrap', () => {
    expect(pilotScrap(pilot)).toEqual({ 1: 2, 3: 1 })
    expect(scrapCount(pilotScrap(pilot))).toBe(3)
  })

  test('moves the pilot’s and the mech’s Scrap into the pool, leaving everything else', () => {
    const mech = {
      cargoLots: [
        {
          id: 'a',
          kind: 'bulk' as const,
          name: 'Tech 1 Scrap',
          cat: 'SCRAP' as const,
          tl: 1,
          qty: 3,
          units: 3,
          code: 'S',
        },
        {
          id: 'b',
          kind: 'unit' as const,
          name: 'Crate',
          cat: 'SEALED' as const,
          units: 2,
          code: 'C',
        },
      ],
    }
    const move = scrapMove(pilot, mech, { scrapPool: { tl1: 1, bio: 2 } })
    expect(move.moved).toEqual({ 1: 5, 3: 1 })
    expect(move.crawlerPatch.scrapPool).toEqual({ tl1: 6, tl3: 1, bio: 2 })
    expect(move.pilotPatch?.genericInventory.map((e) => e.name)).toEqual(['Tech 9 Scrap', 'Rope'])
    expect(move.mechPatch?.cargoLots.map((l) => l.id)).toEqual(['b'])
  })

  test('a unit that carries none gets no patch', () => {
    const move = scrapMove({ genericInventory: [] }, null, {})
    expect(move.pilotPatch).toBeNull()
    expect(move.mechPatch).toBeNull()
    expect(scrapCount(move.moved)).toBe(0)
    expect(depositScrap({}, {})).toEqual({})
  })
})
