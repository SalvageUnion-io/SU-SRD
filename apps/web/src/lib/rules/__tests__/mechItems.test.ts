/**
 * mechItems — pure helper tests.
 *
 * itemEconomy mines EP cost / Hot heat / Uses from real reference data;
 * repairScrapCost is half SV rounded DOWN (min 1, Core Book p.233).
 */

import { describe, expect, test } from 'bun:test'
import { must } from '../../../components/__tests__/must'
import {
  cycleCondition,
  itemEconomy,
  itemUsesRemaining,
  repairScrapCost,
  resolveModule,
  resolveSystem,
} from '../mechItems'

describe('itemEconomy', () => {
  test('Smoke Machine: EP cost 2, no heat, no uses', () => {
    const entity = resolveSystem('smoke-machine')
    expect(entity).toBeTruthy()
    expect(itemEconomy(must(entity))).toEqual({ epCost: 2, heat: 0, maxUses: 0 })
  })

  test('AFF Coolant Foam: EP cost 1 with Uses 5', () => {
    const entity = resolveSystem('aff-coolant-foam')
    expect(entity).toBeTruthy()
    expect(itemEconomy(must(entity))).toEqual({ epCost: 1, heat: 0, maxUses: 5 })
  })

  test('Mini Mortar: no EP cost, Uses 5', () => {
    const entity = resolveSystem('mini-mortar')
    expect(entity).toBeTruthy()
    const economy = itemEconomy(must(entity))
    expect(economy.epCost).toBe(0)
    expect(economy.maxUses).toBe(5)
  })

  test('Green Laser: Hot weapon — no EP cost, +2 heat per use', () => {
    const entity = resolveSystem('green-laser')
    expect(entity).toBeTruthy()
    const economy = itemEconomy(must(entity))
    expect(economy.epCost).toBe(0)
    expect(economy.heat).toBe(2)
  })
})

describe('resolveSystem / resolveModule ref forms', () => {
  // Installed loadout refs are stored as slugs, and only slugs resolve.
  test('resolveSystem matches a slug ref, and not the display name', () => {
    const bySlug = resolveSystem('mini-mortar')
    expect(bySlug).toBeTruthy()
    expect(bySlug?.name).toBe('Mini Mortar')
    expect(resolveSystem('Mini Mortar')).toBeNull()
  })

  test('resolveModule matches a slug ref', () => {
    const bySlug = resolveModule('comms-module')
    expect(bySlug).toBeTruthy()
    expect(bySlug?.name).toBe('Comms Module')
  })

  test('unresolvable ref returns null (no throw)', () => {
    expect(resolveSystem('not-a-real-system')).toBeNull()
  })
})

describe('repairScrapCost', () => {
  // Core Book p.233: "always round down unless stated otherwise". Neither
  // repair rule (p.221, p.248) states otherwise, so an odd Salvage Value
  // rounds down — SV 5 costs 2, not 3.
  test('half SV rounded down', () => {
    expect(repairScrapCost(5)).toBe(2)
    expect(repairScrapCost(4)).toBe(2)
    expect(repairScrapCost(7)).toBe(3)
  })

  test('minimum 1, even for SV 0/undefined', () => {
    expect(repairScrapCost(0)).toBe(1)
    expect(repairScrapCost(1)).toBe(1)
    expect(repairScrapCost(undefined)).toBe(1)
  })
})

describe('cycleCondition', () => {
  test('Intact → Damaged → Destroyed → Intact', () => {
    expect(cycleCondition('intact')).toBe('damaged')
    expect(cycleCondition('damaged')).toBe('destroyed')
    expect(cycleCondition('destroyed')).toBe('intact')
  })
})

describe('itemUsesRemaining', () => {
  test('an absent count is full, a stored one is capped at the max', () => {
    expect(itemUsesRemaining(3, undefined)).toBe(3)
    expect(itemUsesRemaining(3, 1)).toBe(1)
    expect(itemUsesRemaining(3, 9)).toBe(3)
  })

  test('an item with no uses counter has none left', () => {
    expect(itemUsesRemaining(0, 2)).toBe(0)
  })
})
