/**
 * Unit tests for cargo.ts — cargo capacity enforcement (AC-5, REQ-015).
 *
 * Uses a mix of real salvageunion-reference data (for ref-linked items) and
 * hand-crafted fixtures (for custom items and edge cases).
 */
import { beforeAll, describe, expect, it } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import { computeCargoCapacity } from '../cargo'
import type { CargoItem, CargoParent } from '../types'

beforeAll(async () => {
  await SalvageUnionReference.preload(['equipment', 'systems', 'modules'])
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const parent6: CargoParent = { cargoCapacity: 6 }
const parent0: CargoParent = { cargoCapacity: 0 }

describe('computeCargoCapacity — happy path', () => {
  it('returns zero usage for an empty items array', () => {
    const result = computeCargoCapacity(parent6, [])
    expect(result.used).toBe(0)
    expect(result.max).toBe(6)
    expect(result.violations).toHaveLength(0)
  })

  it('counts custom items by their explicit slotCount', () => {
    const items: CargoItem[] = [
      { kind: 'custom', name: 'Rope', slotCount: 1 },
      { kind: 'custom', name: 'Heavy Barrel', slotCount: 2 },
    ]
    const result = computeCargoCapacity(parent6, items)
    expect(result.used).toBe(3)
    expect(result.violations).toHaveLength(0)
  })

  it('resolves ref-linked equipment items from real salvageunion-reference data', () => {
    // Equipment items each count as 1 slot
    const equipment = SalvageUnionReference.Equipment.all().slice(0, 2)
    const items: CargoItem[] = equipment.map((e) => ({
      kind: 'ref' as const,
      ref: e.name,
    }))
    const result = computeCargoCapacity(parent6, items)
    // 2 equipment items × 1 slot each = 2
    expect(result.used).toBe(2)
    expect(result.violations.filter((v) => v.kind === 'missing-ref')).toHaveLength(0)
  })

  it('handles mixed reference and custom items', () => {
    const equipment = SalvageUnionReference.Equipment.all()[0]
    const items: CargoItem[] = [
      { kind: 'ref', ref: equipment?.name ?? 'Fallback', slotCount: 1 },
      { kind: 'custom', name: 'Spare Fuel Cell', slotCount: 2 },
    ]
    const result = computeCargoCapacity(parent6, items)
    expect(result.used).toBe(3)
    expect(result.violations).toHaveLength(0)
  })

  it('respects slotCount override on a ref-linked item', () => {
    const equipment = SalvageUnionReference.Equipment.all()[0]
    const items: CargoItem[] = [{ kind: 'ref', ref: equipment?.name ?? 'Fallback', slotCount: 3 }]
    const result = computeCargoCapacity(parent6, items)
    expect(result.used).toBe(3)
  })

  it('exactly at max capacity produces no over-capacity violation', () => {
    const items: CargoItem[] = Array.from({ length: 6 }, (_, i) => ({
      kind: 'custom' as const,
      name: `Item${i}`,
      slotCount: 1,
    }))
    const result = computeCargoCapacity(parent6, items)
    expect(result.used).toBe(6)
    expect(result.max).toBe(6)
    expect(result.violations.filter((v) => v.kind === 'over-capacity')).toHaveLength(0)
  })
})

describe('computeCargoCapacity — over-capacity violation', () => {
  it('raises over-capacity when custom items exceed max', () => {
    const items: CargoItem[] = [{ kind: 'custom', name: 'Huge Crate', slotCount: 10 }]
    const result = computeCargoCapacity(parent6, items)

    const violation = result.violations.find((v) => v.kind === 'over-capacity')
    expect(violation).toBeDefined()
    expect(violation?.kind).toBe('over-capacity')
    expect(violation?.details.used).toBe(10)
    expect(violation?.details.max).toBe(6)
  })

  it('raises over-capacity for a zero-capacity parent with any item', () => {
    const items: CargoItem[] = [{ kind: 'custom', name: 'Tiny Stone', slotCount: 1 }]
    const result = computeCargoCapacity(parent0, items)

    const violation = result.violations.find((v) => v.kind === 'over-capacity')
    expect(violation).toBeDefined()
  })

  it('boundary: exactly at capacity (used === max) does NOT raise over-capacity', () => {
    const items: CargoItem[] = [{ kind: 'custom', name: 'Filled To Cap', slotCount: 6 }]
    const result = computeCargoCapacity(parent6, items)
    expect(result.used).toBe(6)
    expect(result.violations.filter((v) => v.kind === 'over-capacity')).toHaveLength(0)
  })

  it('boundary: exactly one over capacity (used === max + 1) raises over-capacity', () => {
    const items: CargoItem[] = [{ kind: 'custom', name: 'One Too Many', slotCount: 7 }]
    const result = computeCargoCapacity(parent6, items)
    const violation = result.violations.find((v) => v.kind === 'over-capacity')
    expect(violation).toBeDefined()
    expect(violation?.details.used).toBe(7)
    expect(violation?.details.max).toBe(6)
  })

  it('boundary: a zero-capacity parent with an empty item list raises no violation', () => {
    const result = computeCargoCapacity(parent0, [])
    expect(result.used).toBe(0)
    expect(result.violations).toHaveLength(0)
  })
})

describe('computeCargoCapacity — missing-ref violation', () => {
  it('raises missing-ref for an unknown item reference', () => {
    const items: CargoItem[] = [{ kind: 'ref', ref: 'Legendary Artifact That Does Not Exist' }]
    const result = computeCargoCapacity(parent6, items)

    const violation = result.violations.find((v) => v.kind === 'missing-ref')
    expect(violation).toBeDefined()
    expect(violation?.kind).toBe('missing-ref')
    expect(violation?.details.ref).toBe('Legendary Artifact That Does Not Exist')
  })

  it('counts a missing-ref item as 1 slot (fallback) so it still affects totals', () => {
    const items: CargoItem[] = [{ kind: 'ref', ref: 'Completely Unknown Item' }]
    const result = computeCargoCapacity(parent6, items)
    expect(result.used).toBe(1) // fallback = 1
  })

  it('surfaces missing-ref AND over-capacity simultaneously when applicable', () => {
    // Zero-capacity parent with a missing-ref item → both violations
    const items: CargoItem[] = [{ kind: 'ref', ref: 'Unknown Heavy Gear' }]
    const result = computeCargoCapacity(parent0, items)

    expect(result.violations.some((v) => v.kind === 'missing-ref')).toBe(true)
    expect(result.violations.some((v) => v.kind === 'over-capacity')).toBe(true)
  })
})
