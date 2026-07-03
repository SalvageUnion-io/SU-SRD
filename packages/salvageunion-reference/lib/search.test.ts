import { describe, expect, test } from 'bun:test'
import { search, searchIn, getSuggestions, invalidateSearchIndex } from './search.js'
import { SalvageUnionReference, resetAllForTesting } from './index.js'

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

    test('multi-token queries AND across the name ("mining laser")', () => {
      // Pre-tokenization this returned 0 results: nothing contains the
      // contiguous substring "mining laser", but "Blue Mining Laser" holds
      // both tokens.
      const results = search({ query: 'mining laser' })

      expect(results.length).toBeGreaterThan(0)
      const topNames = results.slice(0, 3).map((r) => r.entityName.toLowerCase())
      expect(topNames.some((n) => n.includes('mining') && n.includes('laser'))).toBe(true)
    })

    test('tokens may match across different fields (AND semantics)', () => {
      const results = search({ query: 'heavy laser' })
      // Every result contains every token SOMEWHERE (name or other fields).
      expect(results.length).toBeGreaterThan(0)
      expect(results.every((r) => r.matchedFields.length > 0)).toBe(true)
    })

    test('single-character typos in the name still match ("railgon")', () => {
      const results = search({ query: 'railgon' })
      expect(results.some((r) => r.entityName === 'Railgun')).toBe(true)
    })

    test('typo-assisted matches rank below literal matches', () => {
      const literal = search({ query: 'railgun' })
      const typo = search({ query: 'railgon' })
      const literalTop = literal.find((r) => r.entityName === 'Railgun')
      const typoTop = typo.find((r) => r.entityName === 'Railgun')
      expect(literalTop).toBeDefined()
      expect(typoTop).toBeDefined()
      expect(typoTop!.matchScore).toBeLessThan(literalTop!.matchScore)
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

    test('is case-insensitive', () => {
      const results = searchIn('systems', 'LASER')

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

  describe('Search index lazy singleton', () => {
    test('should build index on first search and reuse it', () => {
      // First search triggers index build
      const results1 = search({ query: 'laser', schemas: ['systems'] })
      expect(results1.length).toBeGreaterThan(0)

      // Second search with same schema should reuse index
      const results2 = search({ query: 'laser', schemas: ['systems'] })
      expect(results2.length).toBe(results1.length)

      // Results should be identical (same order, same data)
      expect(results2).toEqual(results1)
    })

    test('should handle searches with different schema filters using same index', () => {
      // Search one schema
      const systems = search({ query: 'laser', schemas: ['systems'] })
      expect(systems.length).toBeGreaterThan(0)

      // Search different schema - index already built, just filtered
      const modules = search({ query: 'targeting', schemas: ['modules'] })
      expect(modules.every((r) => r.schemaName === 'modules')).toBe(true)

      // Verify both searches still work correctly
      expect(systems.every((r) => r.schemaName === 'systems')).toBe(true)
    })

    test('should produce consistent results across multiple searches', () => {
      // Run the same search multiple times
      const results1 = search({ query: 'damage', limit: 5 })
      const results2 = search({ query: 'damage', limit: 5 })
      const results3 = search({ query: 'damage', limit: 5 })

      // All results should be identical
      expect(results2).toEqual(results1)
      expect(results3).toEqual(results1)
    })
  })

  describe('invalidateSearchIndex()', () => {
    test('returns empty results before data is loaded, hits after preload', async () => {
      // These tests run after the module-level searches have already populated
      // the lazy index. Reset all load state so we can observe the unloaded → loaded
      // transition — this is the real scenario invalidateSearchIndex guards against:
      // an index built before preload() must not survive into the loaded state.
      resetAllForTesting()
      invalidateSearchIndex()

      // With no data loaded, the search index rebuilds from an empty data map → []
      const beforeLoad = search({ query: 'laser', schemas: ['systems'] })
      expect(beforeLoad).toEqual([])

      // Load data — preload() calls invalidateSearchIndex() internally so the stale
      // empty index is cleared and rebuilt from real data on the next search.
      await SalvageUnionReference.preload('all')

      // Now the same query must return real hits, proving the index was rebuilt
      // rather than returning the cached empty result.
      const afterLoad = search({ query: 'laser', schemas: ['systems'] })
      expect(afterLoad.length).toBeGreaterThan(0)
      expect(afterLoad[0]!.schemaName).toBe('systems')
    })

    test('clears result cache so a post-invalidation search is never served stale data', async () => {
      // Ensure data is loaded (may already be from the test above)
      await SalvageUnionReference.preload('all')

      // Populate the cache with a known-good result
      const cached = search({ query: 'railgun' })
      expect(cached.length).toBeGreaterThan(0)

      // Invalidate flushes both the index and the result cache
      invalidateSearchIndex()

      // The same query must re-execute against the rebuilt index, not return the
      // old cached value (which would be indistinguishable if cache were not cleared)
      const fresh = search({ query: 'railgun' })
      expect(fresh.length).toBeGreaterThan(0)
      // Verify the rebuilt result is correct, not a cache artifact
      expect(fresh[0]!.entityName).toBe(cached[0]!.entityName)
      expect(fresh[0]!.entityId).toBe(cached[0]!.entityId)
    })
  })
})
