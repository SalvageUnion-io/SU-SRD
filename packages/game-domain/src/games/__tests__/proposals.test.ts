import { describe, expect, test } from 'bun:test'
import { makeScrapLot, makeUnitLot } from '../../schemas/cargoLot'
import { proposalValueText } from '../proposals'

describe('what a proposal asks, as its line reads it', () => {
  test('a number reads as itself', () => {
    expect(proposalValueText(7)).toBe('7')
  })

  test('a bulk lot keeps its quantity (r8 B2)', () => {
    expect(proposalValueText([makeScrapLot(1, 3)])).toBe('+ 3 Tech 1 Scrap')
  })

  test('a whole unit reads by its name alone', () => {
    expect(proposalValueText([makeUnitLot('Mule (Damaged)'), makeScrapLot(2, 1)])).toBe(
      '+ Mule (Damaged), 1 Tech 2 Scrap'
    )
  })
})
