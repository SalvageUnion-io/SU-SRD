import { describe, expect, it } from 'bun:test'
import { getJsonSchemaDefinition, getAllJsonSchemaDefinitions } from './schemaDefinitions.js'

describe('getJsonSchemaDefinition', () => {
  it('returns a JSON Schema object for a known schema ID', () => {
    const schema = getJsonSchemaDefinition('chassis')
    expect(schema).toBeDefined()
    expect(typeof schema).toBe('object')
    expect(schema?.['$schema']).toBeDefined()
  })

  it('returns undefined for an unknown schema ID', () => {
    const schema = getJsonSchemaDefinition('nonexistent')
    expect(schema).toBeUndefined()
  })
})

describe('getAllJsonSchemaDefinitions', () => {
  it('returns a map with all 28 schema IDs as keys', () => {
    const all = getAllJsonSchemaDefinitions()
    expect(Object.keys(all).length).toBe(28)
    expect(all['chassis']).toBeDefined()
    expect(all['abilities']).toBeDefined()
    expect(all['roll-tables']).toBeDefined()
  })
})
