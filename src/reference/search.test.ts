import { describe, expect, test } from 'bun:test'
import { search, searchIn, getSuggestions } from './search.js'
import { SalvageUnionReference } from './index.js'

describe('Search API', () => {
  describe('search()', () => {
    test('should find entities by exact name match', () => {
      const results = search({ query: 'Railgun' })

      expect(results.length).toBeGreaterThan(0)
      const railgun = results.find((r) => r.entityName === 'Railgun' && r.schemaName === 'systems')
      expect(railgun).toBeDefined()
      expect(railgun?.schemaName).toBe('systems')
    })

    test('should find entities by partial name match', () => {
      const results = search({ query: 'laser' })

      expect(results.length).toBeGreaterThan(0)
      // Should find various laser systems
      const laserNames = results.map((r) => r.entityName)
      expect(laserNames.some((name) => name.toLowerCase().includes('laser'))).toBe(true)
    })

    test('should find entities by description match', () => {
      const results = search({ query: 'damage' })

      expect(results.length).toBeGreaterThan(0)
      // Should find entities with "damage" in description
      const hasDescriptionMatch = results.some((r) => r.matchedFields.includes('description'))
      expect(hasDescriptionMatch).toBe(true)
    })

    test('should return empty array for empty query', () => {
      const results = search({ query: '' })
      expect(results).toEqual([])
    })

    test('should return empty array for whitespace query', () => {
      const results = search({ query: '   ' })
      expect(results).toEqual([])
    })

    test('should filter by specific schemas', () => {
      const results = search({
        query: 'laser',
        schemas: ['systems'],
      })

      expect(results.length).toBeGreaterThan(0)
      // All results should be from systems schema
      expect(results.every((r) => r.schemaName === 'systems')).toBe(true)
    })

    test('should filter by multiple schemas', () => {
      const results = search({
        query: 'targeting',
        schemas: ['systems', 'modules'],
      })

      expect(results.length).toBeGreaterThan(0)
      // All results should be from systems or modules
      expect(results.every((r) => r.schemaName === 'systems' || r.schemaName === 'modules')).toBe(
        true
      )
    })

    test('should respect limit option', () => {
      const results = search({
        query: 'a', // Common letter, should match many
        limit: 10,
      })

      expect(results.length).toBeLessThanOrEqual(10)
    })

    test('should sort by relevance score', () => {
      const results = search({ query: 'laser' })

      // Scores should be in descending order
      for (let i = 1; i < results.length; i++) {
        const prev = results[i - 1]!
        const curr = results[i]!
        expect(prev.matchScore).toBeGreaterThanOrEqual(curr.matchScore)
      }
    })

    test('should prioritize exact name matches', () => {
      const results = search({ query: 'Railgun' })

      // Exact match should be first
      const firstResult = results[0]!
      expect(firstResult.entityName).toBe('Railgun')
      expect(firstResult.matchScore).toBeGreaterThan(50) // High score for exact match
    })

    test('should be case-insensitive by default', () => {
      const lowerResults = search({ query: 'railgun' })
      const upperResults = search({ query: 'RAILGUN' })
      const mixedResults = search({ query: 'RailGun' })

      expect(lowerResults.length).toBeGreaterThan(0)
      expect(upperResults.length).toBe(lowerResults.length)
      expect(mixedResults.length).toBe(lowerResults.length)
    })

    test('should support case-sensitive search', () => {
      const results = search({
        query: 'Railgun',
        caseSensitive: true,
      })

      expect(results.length).toBeGreaterThan(0)

      // Should not match lowercase "railgun" in descriptions
      const lowerResults = search({
        query: 'railgun',
        caseSensitive: true,
      })

      // Case-sensitive should have different results
      expect(lowerResults.length).not.toBe(results.length)
    })

    test('should include matched fields in results', () => {
      const results = search({ query: 'laser' })

      expect(results.length).toBeGreaterThan(0)
      // Should have matchedFields array
      const firstResult = results[0]!
      expect(firstResult.matchedFields).toBeDefined()
      expect(Array.isArray(firstResult.matchedFields)).toBe(true)
      expect(firstResult.matchedFields.length).toBeGreaterThan(0)
    })

    test('should include schema metadata in results', () => {
      const results = search({ query: 'laser' })

      expect(results.length).toBeGreaterThan(0)
      const firstResult = results[0]!
      expect(firstResult.schemaName).toBeDefined()
      expect(firstResult.schemaTitle).toBeDefined()
      expect(typeof firstResult.schemaTitle).toBe('string')
    })
  })

  describe('searchIn()', () => {
    test('should search within specific schema', () => {
      const systems = searchIn('systems', 'laser')

      expect(systems.length).toBeGreaterThan(0)
      // All results should have system properties
      expect(systems.every((s) => 'name' in s)).toBe(true)
    })

    test('should return typed results', () => {
      const systems = searchIn('systems', 'laser')

      // TypeScript should infer correct type
      expect(systems[0]).toHaveProperty('name')
    })

    test('should respect limit option', () => {
      const systems = searchIn('systems', 'a', { limit: 5 })

      expect(systems.length).toBeLessThanOrEqual(5)
    })

    test('should support case-sensitive search', () => {
      const results = searchIn('systems', 'Laser', { caseSensitive: true })

      expect(results.length).toBeGreaterThan(0)
    })
  })

  describe('getSuggestions()', () => {
    test('should return unique entity names', () => {
      const suggestions = getSuggestions('las')

      expect(suggestions.length).toBeGreaterThan(0)
      // Should be unique
      const uniqueSuggestions = new Set(suggestions)
      expect(uniqueSuggestions.size).toBe(suggestions.length)
    })

    test('should limit suggestions', () => {
      const suggestions = getSuggestions('a', { limit: 5 })

      expect(suggestions.length).toBeLessThanOrEqual(5)
    })

    test('should filter by schemas', () => {
      const suggestions = getSuggestions('las', {
        schemas: ['systems'],
      })

      expect(suggestions.length).toBeGreaterThan(0)
    })

    test('should return most relevant suggestions first', () => {
      const suggestions = getSuggestions('laser')

      // Should include laser-related names
      expect(suggestions.some((s) => s.toLowerCase().includes('laser'))).toBe(true)
    })
  })

  describe('SalvageUnionReference.search()', () => {
    test('should work via static method', () => {
      const results = SalvageUnionReference.search({ query: 'laser' })

      expect(results.length).toBeGreaterThan(0)
    })

    test('should filter by schemas', () => {
      const results = SalvageUnionReference.search({
        query: 'laser',
        schemas: ['systems'],
      })

      expect(results.length).toBeGreaterThan(0)
      expect(results.every((r) => r.schemaName === 'systems')).toBe(true)
    })
  })

  describe('SalvageUnionReference.searchIn()', () => {
    test('should work via static method', () => {
      const systems = SalvageUnionReference.searchIn('systems', 'laser')

      expect(systems.length).toBeGreaterThan(0)
    })
  })
})
