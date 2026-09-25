import { describe, expect, it } from 'bun:test'
import { getJsonSchemaDefinition } from './schemaDefinitions.js'
import { registry } from './schemas/registry.js'

describe('getJsonSchemaDefinition', () => {
  it('returns a JSON Schema object for a known schema ID', () => {
    const schema = getJsonSchemaDefinition('chassis')
    expect(schema).toBeDefined()
    expect(typeof schema).toBe('object')
    expect(schema?.$schema).toBeDefined()
  })

  it('returns undefined for an unknown schema ID', () => {
    const schema = getJsonSchemaDefinition('nonexistent')
    expect(schema).toBeUndefined()
  })
})

describe('schema definition coverage', () => {
  it('has a JSON Schema for every registry schema id', () => {
    for (const { id } of registry) {
      expect(getJsonSchemaDefinition(id), `missing JSON Schema for "${id}"`).toBeDefined()
    }
  })
})
