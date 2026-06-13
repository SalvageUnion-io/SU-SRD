/**
 * pilotInventory — truthful slot + uses math (plan 4.4, rules A13/A14).
 *
 * Uses real reference data: Rifle (1 slot), Rocket Launcher (Heavy → 2 slots,
 * Uses 3), First Aid Kit (1 slot, Uses 3).
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'

import {
  equipmentMaxUses,
  equipmentSlotCost,
  genericEntrySlots,
  pilotInventoryCapacity,
  pilotInventoryUsed,
  resolveEquipment,
} from '../pilotInventory'
import type { GenericInventoryEntry, Pilot } from '../../../lib/schemas/pilot'

beforeAll(async () => {
  await SalvageUnionReference.preload(['equipment', 'actions'])
})

function inventory(
  equipment: string[],
  genericInventory: GenericInventoryEntry[] = []
): Pick<Pilot, 'equipment' | 'genericInventory'> {
  return { equipment, genericInventory }
}

describe('equipmentSlotCost', () => {
  test('standard equipment costs 1 slot', () => {
    expect(equipmentSlotCost(resolveEquipment('Rifle'))).toBe(1)
  })

  test('Heavy equipment costs 2 slots', () => {
    expect(equipmentSlotCost(resolveEquipment('Rocket Launcher'))).toBe(2)
  })

  test('unresolved equipment counts 1 slot (never undercounts to 0)', () => {
    expect(equipmentSlotCost(null)).toBe(1)
  })
})

describe('equipmentMaxUses', () => {
  test('reads the uses trait (First Aid Kit = 3)', () => {
    expect(equipmentMaxUses(resolveEquipment('First Aid Kit'))).toBe(3)
  })

  test('null for items without a uses trait', () => {
    expect(equipmentMaxUses(resolveEquipment('Rifle'))).toBeNull()
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
      ['Rifle', 'Rocket Launcher'],
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

  test('empty inventory uses 0 slots', () => {
    expect(pilotInventoryUsed(inventory([]))).toBe(0)
  })
})
