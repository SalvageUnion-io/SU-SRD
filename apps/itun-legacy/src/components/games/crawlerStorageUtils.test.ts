import { describe, test, expect } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import {
  partitionCargo,
  buildCustomCargoMetadata,
  resolveEntitySchema,
} from './crawlerStorageUtils'
import type { CargoRow } from '../../types/common'

function makeCargo(o: Partial<CargoRow> = {}): CargoRow {
  return {
    id: `c-${Math.random()}`,
    parent_id: 'x',
    user_id: 'u',
    name: 'T',
    schema_name: null,
    schema_ref_id: null,
    amount: 1,
    metadata: null,
    created_at: '',
    ...o,
  } as CargoRow
}

describe('partitionCargo', () => {
  test('empty', () => {
    const r = partitionCargo([])
    expect(r.entityItems).toEqual([])
    expect(r.customItems).toEqual([])
  })
  test('separates', () => {
    const r = partitionCargo([makeCargo({ schema_ref_id: 'x' }), makeCargo()])
    expect(r.entityItems).toHaveLength(1)
    expect(r.customItems).toHaveLength(1)
  })
  test('null', () => {
    const r = partitionCargo(null)
    expect(r.entityItems).toEqual([])
  })
})
describe('buildCustomCargoMetadata', () => {
  test('category', () => {
    expect(
      buildCustomCargoMetadata({
        category: 'c',
        description: '',
        techLevel: undefined,
        salvageValue: '',
        slotsRequired: '',
        structurePoints: '',
        energyPoints: '',
        heatCapacity: '',
        fields: {},
      }).category
    ).toBe('c')
  })
  test('excludes disabled', () => {
    expect(
      buildCustomCargoMetadata({
        category: 'o',
        description: '',
        techLevel: '3',
        salvageValue: '100',
        slotsRequired: '',
        structurePoints: '',
        energyPoints: '',
        heatCapacity: '',
        fields: {},
      }).tech_level
    ).toBeUndefined()
  })
})
describe('resolveEntitySchema', () => {
  test('unknown returns null', () => {
    expect(resolveEntitySchema('xxx')).toBeNull()
  })
  test('resolves chassis', () => {
    const c = SalvageUnionReference.Chassis.all()
    if (c.length) {
      expect(resolveEntitySchema(c[0]!.id)).not.toBeNull()
    }
  })
})
