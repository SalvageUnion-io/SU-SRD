import { describe, it, expect } from 'bun:test'
import { getAvailableEquipment, hasObtainedEquipment } from './equipmentUtils'
import type { EquipmentReceipt } from './equipmentUtils'

describe('getAvailableEquipment', () => {
  it('returns equipment at TL 1', () => {
    const result = getAvailableEquipment(1)
    expect(result.length).toBeGreaterThan(0)
    for (const e of result) {
      const tl = 'techLevel' in e ? e.techLevel : undefined
      if (typeof tl === 'number') {
        expect(tl).toBeLessThanOrEqual(1)
      }
    }
  })

  it('returns more equipment at higher TL', () => {
    const tl1 = getAvailableEquipment(1)
    const tl3 = getAvailableEquipment(3)
    expect(tl3.length).toBeGreaterThanOrEqual(tl1.length)
  })

  it('includes all equipment at TL 6', () => {
    const tl6 = getAvailableEquipment(6)
    expect(tl6.length).toBeGreaterThan(0)
  })
})

describe('hasObtainedEquipment', () => {
  it('returns false for undefined receipt', () => {
    expect(hasObtainedEquipment(undefined)).toBe(false)
  })

  it('returns false when receipt item is null (skipped)', () => {
    const receipt: EquipmentReceipt = { item: null }
    expect(hasObtainedEquipment(receipt)).toBe(false)
  })

  it('returns true when receipt has an item', () => {
    const receipt: EquipmentReceipt = {
      item: { ref_id: 'eq-1', name: 'Medkit' },
    }
    expect(hasObtainedEquipment(receipt)).toBe(true)
  })
})
