import { describe, expect, it } from 'bun:test'
import { EntitySchemaNames } from './index.js'
import { BaseEntitySchema } from './schemas/objects/entityBase.js'
import { entityFixture } from './testing.js'

describe('entityFixture', () => {
  // The header promises the defaulted base fields are valid for every entity
  // schema. A default that drifts out of BaseEntitySchema (a renamed source, a
  // page of 0) would make every fixture quietly malformed.
  it.each([...EntitySchemaNames])('defaults pass BaseEntitySchema for %s', (schemaName) => {
    expect(BaseEntitySchema.safeParse(entityFixture(schemaName)).success).toBe(true)
  })

  it('layers overrides over the defaults', () => {
    const chassis = entityFixture('chassis', { name: 'Atlas' })
    expect(chassis.name).toBe('Atlas')
    expect(chassis.id).toBe('fixture-chassis')
  })
})
