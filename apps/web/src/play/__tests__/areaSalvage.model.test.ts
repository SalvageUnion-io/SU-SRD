import { describe, expect, test } from 'bun:test'
import type { AreaSalvageResult } from 'salvageunion-reference/rules'
import { areaSalvageRowText, haulText, isExpertSalvager } from '../areaSalvage.model'

/** What an Area Salvage's resolve says (Core Book p.248). */

const SCRAP: AreaSalvageResult = {
  roll: 12,
  band: 'scrap-2',
  label: '2 Scrap',
  scrapQty: 2,
  areaTl: 3,
  requiresPlayerChoice: false,
  itemCount: 0,
}

const JACKPOT: AreaSalvageResult = {
  ...SCRAP,
  roll: 20,
  band: 'jackpot',
  scrapQty: 0,
  requiresPlayerChoice: true,
  itemCount: 1,
}

const haul = (carried: number, leftBehind: number) => ({ carried, leftBehind, patch: null })

describe('haulText', () => {
  test('what was carried, and what stayed for want of room', () => {
    expect(haulText(SCRAP, haul(2, 0), 'Tenacity')).toBe('2 Tech 3 Scrap into Tenacity.')
    expect(haulText(SCRAP, haul(1, 1), 'Tenacity')).toBe(
      '1 Tech 3 Scrap into Tenacity. 1 more stays in the area: there is no room for it.'
    )
    expect(haulText(SCRAP, haul(0, 2), 'Tenacity')).toBe(
      '2 more stays in the area: there is no room for it.'
    )
  })

  test('nothing found still spends the Supply', () => {
    expect(haulText({ ...SCRAP, scrapQty: 0 }, haul(0, 0), 'Tenacity')).toBe(
      'Nothing found. The Supply is spent all the same.'
    )
  })

  test('a 20 finds a Damaged item, two for an Expert Salvager, and any Scrap after it', () => {
    expect(haulText(JACKPOT, haul(0, 0), 'Tenacity')).toStartWith(
      'A Mech Chassis, System or Module of Tech 3, Damaged'
    )
    expect(haulText({ ...JACKPOT, itemCount: 2 }, haul(1, 0), 'Tenacity')).toEndWith(
      ' 1 Tech 3 Scrap into Tenacity.'
    )
    expect(haulText({ ...JACKPOT, itemCount: 2 }, haul(1, 0), 'Tenacity')).toStartWith(
      'Two Mech Chassis, Systems or Modules'
    )
  })
})

describe('the rest of the resolve', () => {
  test('an Expert Salvager is a pilot with the ability', () => {
    expect(isExpertSalvager({ abilities: ['expert-salvager'] })).toBe(true)
    expect(isExpertSalvager({ abilities: [] })).toBe(false)
    expect(isExpertSalvager(null)).toBe(false)
  })

  test('the table row is the book’s, and a roll off the table says nothing', () => {
    expect(areaSalvageRowText(20)).not.toBe('')
    expect(areaSalvageRowText(0)).toBe('')
  })
})
