/**
 * Unit tests for capacity.ts — mech slot enforcement (AC-5, REQ-009).
 *
 * Uses REAL data from salvageunion-reference to verify that slot math
 * is computed against actual chassis caps and system slotsRequired values.
 */
import { beforeAll, describe, expect, it } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import { computeMechCapacity } from '../capacity'
import type { MechInput } from '../types'

beforeAll(async () => {
  await SalvageUnionReference.preload(['chassis', 'systems', 'modules'])
})

// ---------------------------------------------------------------------------
// Reference data fixtures (real data — verified against chassis.json)
// Mule: systemSlots=16, moduleSlots=2, cargoCapacity=16, techLevel=1
// ---------------------------------------------------------------------------
const MULE_CHASSIS = 'Mule'

describe('computeMechCapacity — happy path', () => {
  it('returns zero usage for an empty mech', () => {
    const mech: MechInput = {
      chassisRef: MULE_CHASSIS,
      systems: [],
      modules: [],
    }
    const result = computeMechCapacity(mech)

    expect(result.systemSlotsUsed).toBe(0)
    expect(result.moduleSlotsUsed).toBe(0)
    expect(result.systemSlotsMax).toBeGreaterThan(0)
    expect(result.moduleSlotsMax).toBeGreaterThan(0)
    expect(result.violations).toHaveLength(0)
  })

  it('sums system slots correctly from reference data', () => {
    // .50 Cal Machine Gun = slotsRequired 2, Armour Plating = slotsRequired 2
    const mech: MechInput = {
      chassisRef: MULE_CHASSIS,
      systems: [{ ref: '.50 Cal Machine Gun' }, { ref: 'Armour Plating' }],
      modules: [],
    }
    const result = computeMechCapacity(mech)

    expect(result.systemSlotsUsed).toBe(4) // 2 + 2
    expect(result.violations).toHaveLength(0)
  })

  it('respects explicit slotCost override', () => {
    const mech: MechInput = {
      chassisRef: MULE_CHASSIS,
      systems: [{ ref: '.50 Cal Machine Gun', slotCost: 1 }], // overridden from 2 to 1
      modules: [],
    }
    const result = computeMechCapacity(mech)

    expect(result.systemSlotsUsed).toBe(1)
    expect(result.violations).toHaveLength(0)
  })

  it('reports correct max slots matching real chassis data', () => {
    const chassis = SalvageUnionReference.Chassis.find((c) => c.name === MULE_CHASSIS)
    expect(chassis).toBeDefined()
    const mech: MechInput = { chassisRef: MULE_CHASSIS, systems: [], modules: [] }
    const result = computeMechCapacity(mech)

    // Use ?? to avoid undefined; chassis is always defined for Mule (asserted above)
    expect(result.systemSlotsMax).toBe(chassis?.systemSlots ?? -1)
    expect(result.moduleSlotsMax).toBe(chassis?.moduleSlots ?? -1)
  })

  it('exactly at max capacity produces no violations', () => {
    // Mule has 16 system slots — fill exactly to cap with 1-slot systems
    const chassis = SalvageUnionReference.Chassis.find((c) => c.name === MULE_CHASSIS)
    const max = chassis?.systemSlots ?? 0
    const systems = Array.from({ length: max }, (_, i) => ({
      ref: `FakeSystem${i}`,
      slotCost: 1,
    }))

    const mech: MechInput = { chassisRef: MULE_CHASSIS, systems, modules: [] }
    const result = computeMechCapacity(mech)

    expect(result.systemSlotsUsed).toBe(max)
    expect(result.violations.filter((v) => v.kind === 'system-over-slots')).toHaveLength(0)
  })
})

describe('computeMechCapacity — system-over-slots violation', () => {
  it('raises system-over-slots when system usage exceeds chassis cap', () => {
    // Force over-capacity with explicit slotCosts
    const chassis = SalvageUnionReference.Chassis.find((c) => c.name === MULE_CHASSIS)
    const max = chassis?.systemSlots ?? 0
    const systems = [{ ref: '.50 Cal Machine Gun', slotCost: max + 1 }]

    const mech: MechInput = { chassisRef: MULE_CHASSIS, systems, modules: [] }
    const result = computeMechCapacity(mech)

    const violation = result.violations.find((v) => v.kind === 'system-over-slots')
    expect(violation).toBeDefined()
    expect(violation?.kind).toBe('system-over-slots')
    expect(violation?.details.used).toBe(max + 1)
    expect(violation?.details.max).toBe(max)
  })
})

describe('computeMechCapacity — module-over-slots violation', () => {
  it('raises module-over-slots when module usage exceeds chassis cap', () => {
    // Mule has 2 module slots — exceed with 3 modules @ 1 slot each
    const mech: MechInput = {
      chassisRef: MULE_CHASSIS,
      systems: [],
      modules: [
        { ref: 'Comms Module', slotCost: 1 },
        { ref: 'Comms Module', slotCost: 1 },
        { ref: 'Comms Module', slotCost: 1 },
      ],
    }
    const result = computeMechCapacity(mech)

    const violation = result.violations.find((v) => v.kind === 'module-over-slots')
    expect(violation).toBeDefined()
    expect(violation?.kind).toBe('module-over-slots')
    expect(violation?.details.used).toBe(3)
    expect(violation?.details.max).toBe(2)
  })
})

describe('computeMechCapacity — chassis-not-found violation', () => {
  it('raises chassis-not-found for an unknown chassis name', () => {
    const mech: MechInput = {
      chassisRef: 'Nonexistent Chassis XYZ',
      systems: [],
      modules: [],
    }
    const result = computeMechCapacity(mech)

    const violation = result.violations.find((v) => v.kind === 'chassis-not-found')
    expect(violation).toBeDefined()
    expect(violation?.kind).toBe('chassis-not-found')
    expect(violation?.details.chassisRef).toBe('Nonexistent Chassis XYZ')
  })

  it('returns zero max slots when chassis is not found', () => {
    const mech: MechInput = {
      chassisRef: 'Ghost Chassis',
      systems: [],
      modules: [],
    }
    const result = computeMechCapacity(mech)

    expect(result.systemSlotsMax).toBe(0)
    expect(result.moduleSlotsMax).toBe(0)
  })
})
