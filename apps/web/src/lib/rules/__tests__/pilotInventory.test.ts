/**
 * pilotInventory — truthful slot + uses math.
 *
 * Uses real reference data: Rifle (1 slot), Rocket Launcher (Heavy → 2 slots,
 * Uses 3), First Aid Kit (1 slot, Uses 3).
 */

import { describe, expect, test } from 'bun:test'
import type { GenericInventoryEntry, Pilot } from 'game-domain/schemas/pilot'
import {
  carriedEquipment,
  equipmentMaxUses,
  equipmentSlotCost,
  genericEntrySlots,
  grantedEquipment,
  pilotInventoryCapacity,
  pilotInventoryUsed,
  resolveEquipment,
} from '../pilotInventory'

function inventory(
  equipment: string[],
  genericInventory: GenericInventoryEntry[] = []
): Pick<Pilot, 'equipment' | 'genericInventory'> {
  return { equipment, genericInventory }
}

describe('resolveEquipment — slugs', () => {
  test('resolves a kebab slug, and not the display name', () => {
    expect(resolveEquipment('remote-mine')?.name).toBe('Remote Mine')
    expect(resolveEquipment('Remote Mine')).toBeNull()
  })

  test('resolves the drone-equipment slug (survey-drone)', () => {
    expect(resolveEquipment('survey-drone')?.name).toBe('Survey Drone')
  })

  test('unknown slug returns null', () => {
    expect(resolveEquipment('not-a-real-thing')).toBeNull()
  })
})

describe('equipmentSlotCost', () => {
  test('standard equipment costs 1 slot', () => {
    expect(equipmentSlotCost(resolveEquipment('rifle'))).toBe(1)
  })

  test('Heavy equipment costs 2 slots', () => {
    expect(equipmentSlotCost(resolveEquipment('rocket-launcher'))).toBe(2)
  })

  test('unresolved equipment counts 1 slot (never undercounts to 0)', () => {
    expect(equipmentSlotCost(null)).toBe(1)
  })
})

describe('equipmentMaxUses', () => {
  test('reads the uses trait (First Aid Kit = 3)', () => {
    expect(equipmentMaxUses(resolveEquipment('first-aid-kit'))).toBe(3)
  })

  test('null for items without a uses trait', () => {
    expect(equipmentMaxUses(resolveEquipment('rifle'))).toBeNull()
  })

  test('null for unresolved items', () => {
    expect(equipmentMaxUses(null)).toBeNull()
  })
})

describe('genericEntrySlots', () => {
  test('slotCost × qty (Scrap 3 each)', () => {
    expect(genericEntrySlots({ id: 'g1', name: 'Scrap', slotCost: 3 })).toBe(3)
    expect(genericEntrySlots({ id: 'g2', name: 'Scrap', slotCost: 3, qty: 2 })).toBe(6)
  })
})

describe('pilotInventoryUsed / pilotInventoryCapacity', () => {
  test('sums equipment + generic entries truthfully', () => {
    const pilot = inventory(
      ['rifle', 'rocket-launcher'],
      [{ id: 'g1', name: 'Scrap', slotCost: 3 }]
    )
    // 1 + 2 + 3
    expect(pilotInventoryUsed(pilot)).toBe(6)
  })

  test('capacity is the base 6 slots', () => {
    expect(pilotInventoryCapacity()).toBe(6)
  })

  test('capacity adds Beefcake +4', () => {
    expect(pilotInventoryCapacity({ abilities: ['beefcake'] })).toBe(10)
    expect(pilotInventoryCapacity({})).toBe(6)
  })

  // `maxInventorySlotsOverride` has been in the persisted Pilot schema all
  // along but was read by nothing, so a Free-Edit pin silently did nothing.
  // The capacity now derives through `pilotMaxInventorySlots`, so the pin wins
  // over the derivation exactly like the HP and AP pins do.
  test('capacity honours the maxInventorySlotsOverride pin', () => {
    expect(pilotInventoryCapacity({ abilities: ['beefcake'], maxInventorySlotsOverride: 3 })).toBe(
      3
    )
    expect(pilotInventoryCapacity({ maxInventorySlotsOverride: 0 })).toBe(0)
  })

  test('empty inventory uses 0 slots', () => {
    expect(pilotInventoryUsed(inventory([]))).toBe(0)
  })
})

describe('grantedEquipment / carriedEquipment', () => {
  test('an ability that grants an item puts it in the pilot hands', () => {
    const pilot = { abilities: ['spotter', 'custom-sniper-rifle'], equipment: ['first-aid-kit'] }
    expect(grantedEquipment(pilot)).toEqual(['custom-sniper-rifle'])
    expect(carriedEquipment(pilot)).toEqual(['first-aid-kit', 'custom-sniper-rifle'])
  })

  test('an item already carried is not granted twice', () => {
    const pilot = { abilities: ['custom-sniper-rifle'], equipment: ['custom-sniper-rifle'] }
    expect(grantedEquipment(pilot)).toEqual([])
    expect(carriedEquipment(pilot)).toEqual(['custom-sniper-rifle'])
  })

  test("a partner's equipment is its partner, never carried gear", () => {
    expect(
      grantedEquipment({ abilities: ['survey-drone', 'mecha-packmaster'], equipment: [] })
    ).toEqual([])
  })
})
