/**
 * pilotInventory — truthful slot + uses math (plan 4.4, rules A13/A14).
 *
 * Uses real reference data: Rifle (1 slot), Rocket Launcher (Heavy → 2 slots,
 * Uses 3), First Aid Kit (1 slot, Uses 3).
 */

import { describe, expect, test } from 'bun:test'
import type { GenericInventoryEntry, Pilot } from '../../../lib/schemas/pilot'
import {
  equipmentMaxUses,
  equipmentSlotCost,
  genericEntrySlots,
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

  test('capacity adds maxInventorySlotsModifier (Beefcake +4, rules A13)', () => {
    expect(pilotInventoryCapacity({ maxInventorySlotsModifier: 4 })).toBe(10)
    expect(pilotInventoryCapacity({ maxInventorySlotsModifier: -10 })).toBe(0)
    expect(pilotInventoryCapacity({})).toBe(6)
  })

  // `maxInventorySlotsOverride` has been in the persisted Pilot schema all
  // along but was read by nothing, so a Free-Edit pin silently did nothing.
  // The capacity now derives through `pilotMaxInventorySlots`, so the pin wins
  // over base + modifier exactly like the HP and AP pins do.
  test('capacity honours the maxInventorySlotsOverride pin', () => {
    expect(
      pilotInventoryCapacity({ maxInventorySlotsModifier: 4, maxInventorySlotsOverride: 3 })
    ).toBe(3)
    expect(pilotInventoryCapacity({ maxInventorySlotsOverride: 0 })).toBe(0)
  })

  test('empty inventory uses 0 slots', () => {
    expect(pilotInventoryUsed(inventory([]))).toBe(0)
  })
})
