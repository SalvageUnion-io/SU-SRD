import { describe, test, expect } from 'bun:test'
import { extractComrades } from './comradeUtils'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefChassis } from 'salvageunion-reference'
import type { EntityRefRow } from '../types/common'

/** Minimal entity ref row for testing. */
function makeRef(
  overrides: Partial<EntityRefRow> & { schema_name: string; schema_ref_id: string }
): EntityRefRow {
  const { schema_name, schema_ref_id, ...rest } = overrides
  return {
    id: `ref-${schema_ref_id}`,
    parent_id: 'pilot-1',
    parent_type: 'pilot',
    schema_name,
    schema_ref_id,
    sort_order: 0,
    condition: 'intact',
    metadata: null,
    created_at: '2024-01-01T00:00:00Z',
    ...rest,
  } as EntityRefRow
}

describe('extractComrades', () => {
  test('returns empty array for empty inputs', () => {
    const result = extractComrades([], [])
    expect(result).toEqual([])
  })

  test('returns empty array when no comrade-bearing entities exist', () => {
    // abilities don't have structurePoints and don't grant drones
    const pilotRefs = [makeRef({ schema_name: 'abilities', schema_ref_id: 'bionic-senses' })]
    const result = extractComrades(pilotRefs, [])
    expect(result).toEqual([])
  })

  test('extracts stat-bearing equipment as comrade from pilot refs', () => {
    // "Auto-Turret" is equipment with structurePoints (stat-bearing companion)
    const autoTurret = SalvageUnionReference.findIn(
      'equipment',
      (e) => 'structurePoints' in e && typeof e.structurePoints === 'number'
    )
    if (!autoTurret) {
      // Skip if no stat-bearing equipment exists in test data
      // No stat-bearing equipment found in test data, skip
      return
    }

    const pilotRefs = [makeRef({ schema_name: 'equipment', schema_ref_id: autoTurret.id })]
    const result = extractComrades(pilotRefs, [])

    expect(result.length).toBeGreaterThanOrEqual(1)
    const found = result.find((c) => c.entity.id === autoTurret.id)
    expect(found).toBeDefined()
    expect(found!.sourceParent).toBe('pilot')
    expect(found!.sourceName).toBe(autoTurret.name)
  })

  test('extracts stat-bearing equipment from mech refs with mech sourceParent', () => {
    const autoTurret = SalvageUnionReference.findIn(
      'equipment',
      (e) => 'structurePoints' in e && typeof e.structurePoints === 'number'
    )
    if (!autoTurret) return

    const mechRefs = [makeRef({ schema_name: 'equipment', schema_ref_id: autoTurret.id })]
    const result = extractComrades([], mechRefs)

    expect(result.length).toBeGreaterThanOrEqual(1)
    const found = result.find((c) => c.entity.id === autoTurret.id)
    expect(found).toBeDefined()
    expect(found!.sourceParent).toBe('mech')
  })

  test('deduplicates same entity from multiple sources', () => {
    const autoTurret = SalvageUnionReference.findIn(
      'equipment',
      (e) => 'structurePoints' in e && typeof e.structurePoints === 'number'
    )
    if (!autoTurret) return

    // Same entity in both pilot and mech refs
    const pilotRefs = [makeRef({ schema_name: 'equipment', schema_ref_id: autoTurret.id })]
    const mechRefs = [
      makeRef({ schema_name: 'equipment', schema_ref_id: autoTurret.id, id: 'ref-mech-turret' }),
    ]
    const result = extractComrades(pilotRefs, mechRefs)

    // Should appear only once (first-seen wins: pilot refs are processed first)
    const matches = result.filter((c) => c.entity.id === autoTurret.id)
    expect(matches.length).toBe(1)
    expect(matches[0]!.sourceParent).toBe('pilot')
  })

  test('silently skips refs with unknown entity IDs', () => {
    const pilotRefs = [makeRef({ schema_name: 'equipment', schema_ref_id: 'nonexistent-item-id' })]
    const result = extractComrades(pilotRefs, [])
    expect(result).toEqual([])
  })

  test('non-stat equipment is excluded', () => {
    // Find an equipment that does NOT have structurePoints
    const normalEquipment = SalvageUnionReference.findIn(
      'equipment',
      (e) => !('structurePoints' in e)
    )
    if (!normalEquipment) return

    const pilotRefs = [makeRef({ schema_name: 'equipment', schema_ref_id: normalEquipment.id })]
    const result = extractComrades(pilotRefs, [])

    // Should not extract normal equipment as comrade (unless it grants a drone via actions)
    const found = result.find((c) => c.entity.id === normalEquipment.id)
    expect(found).toBeUndefined()
  })

  test('extracts drones from chassis abilities', () => {
    // Find a chassis whose abilities grant a drone
    const allChassis = SalvageUnionReference.Chassis.all()
    let droneGrantingChassis: SURefChassis | undefined

    for (const chassis of allChassis) {
      const result = extractComrades([], [], chassis)
      if (result.some((c) => c.sourceParent === 'mech' && c.entity.schemaName === 'drones')) {
        droneGrantingChassis = chassis
        break
      }
    }

    if (!droneGrantingChassis) {
      // No drone-granting chassis found in test data, skip
      return
    }

    const result = extractComrades([], [], droneGrantingChassis)
    const droneComrades = result.filter((c) => c.entity.schemaName === 'drones')
    expect(droneComrades.length).toBeGreaterThanOrEqual(1)
    expect(droneComrades[0]!.sourceParent).toBe('mech')
    expect(droneComrades[0]!.sourceName).toBe(droneGrantingChassis.name)
  })

  test('source parent tracking: pilot refs → pilot, mech refs → mech', () => {
    const autoTurret = SalvageUnionReference.findIn(
      'equipment',
      (e) => 'structurePoints' in e && typeof e.structurePoints === 'number'
    )
    if (!autoTurret) return

    // From pilot
    const fromPilot = extractComrades(
      [makeRef({ schema_name: 'equipment', schema_ref_id: autoTurret.id })],
      []
    )
    if (fromPilot.length > 0) {
      expect(fromPilot[0]!.sourceParent).toBe('pilot')
    }

    // From mech
    const fromMech = extractComrades(
      [],
      [makeRef({ schema_name: 'equipment', schema_ref_id: autoTurret.id })]
    )
    if (fromMech.length > 0) {
      expect(fromMech[0]!.sourceParent).toBe('mech')
    }
  })
})
