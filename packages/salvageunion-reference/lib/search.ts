/**
 * Search functionality for Salvage Union data
 */

import type { SURefEntity, SURefEnumSchemaName } from './types/index.js'
import { getSchemaCatalog, getDataMaps } from './ModelFactory.js'
import { extractActions } from './utilities.js'

export interface SearchOptions {
  query: string
  schemas?: SURefEnumSchemaName[]
  limit?: number
  caseSensitive?: boolean
}

// Cache for search results with size limit
const MAX_CACHE_SIZE = 100
const searchCache = new Map<string, SearchResult[]>()

/**
 * Clear the search cache (useful when data is reloaded)
 */
export function clearSearchCache(): void {
  searchCache.clear()
}

/**
 * Get cache size
 */
export function getCacheSize(): number {
  return searchCache.size
}

/**
 * Trim cache if it exceeds max size (LRU eviction)
 */
function trimCache(): void {
  if (searchCache.size > MAX_CACHE_SIZE) {
    // Remove oldest entries (first in map)
    const keysToRemove: string[] = []
    let count = 0
    const toRemove = searchCache.size - MAX_CACHE_SIZE

    for (const key of searchCache.keys()) {
      if (count < toRemove) {
        keysToRemove.push(key)
        count++
      } else {
        break
      }
    }

    for (const key of keysToRemove) {
      searchCache.delete(key)
    }
  }
}

export interface SearchResult {
  schemaName: SURefEnumSchemaName
  schemaTitle: string
  entity: SURefEntity & { schemaName: SURefEnumSchemaName }
  entityId: string
  entityName: string
  matchedFields: string[]
  matchScore: number
}

/**
 * Extract all text from content blocks recursively
 */
function extractContentText(content: unknown): string {
  if (!content) return ''

  if (Array.isArray(content)) {
    return content.map(extractContentText).join(' ')
  }

  if (typeof content === 'object' && content !== null) {
    const block = content as Record<string, unknown>
    let text = ''

    // Extract value field
    if ('value' in block && typeof block.value === 'string') {
      text += block.value + ' '
    }

    // Extract label field
    if ('label' in block && typeof block.label === 'string') {
      text += block.label + ' '
    }

    // Recursively extract from nested items
    if ('items' in block && Array.isArray(block.items)) {
      text += extractContentText(block.items)
    }

    return text
  }

  return ''
}

/**
 * Calculate a relevance score for a search match
 * Higher scores = better matches
 */
function calculateScore(entity: SURefEntity, query: string, matchedFields: string[]): number {
  let score = 0
  const lowerQuery = query.toLowerCase()

  // Exact name match gets highest score
  if (entity.name.toLowerCase() === lowerQuery) {
    score += 100
  }
  // Name starts with query
  else if (entity.name.toLowerCase().startsWith(lowerQuery)) {
    score += 50
  }
  // Name contains query
  else if (entity.name.toLowerCase().includes(lowerQuery)) {
    score += 25
  }

  // Description match gets lower score
  if (
    'description' in entity &&
    typeof entity.description === 'string' &&
    entity.description.toLowerCase().includes(lowerQuery)
  ) {
    score += 10
  }

  // Boost score based on number of matched fields
  score += matchedFields.length * 5

  return score
}

/**
 * Check if an entity matches the search query
 */
function matchesQuery(
  entity: SURefEntity,
  query: string,
  caseSensitive: boolean
): { matches: boolean; matchedFields: string[] } {
  const matchedFields: string[] = []
  const searchQuery = caseSensitive ? query : query.toLowerCase()

  // Check name field (all entities have this)
  const name = caseSensitive ? entity.name : entity.name.toLowerCase()
  if (name.includes(searchQuery)) {
    matchedFields.push('name')
  }

  // Check description field if it exists
  if ('description' in entity && typeof entity.description === 'string') {
    const description = caseSensitive ? entity.description : entity.description.toLowerCase()
    if (description.includes(searchQuery)) {
      matchedFields.push('description')
    }
  }

  // Check effect field if it exists
  if ('effect' in entity && typeof entity.effect === 'string') {
    const effect = caseSensitive ? entity.effect : entity.effect.toLowerCase()
    if (effect.includes(searchQuery)) {
      matchedFields.push('effect')
    }
  }

  // Check content blocks if they exist
  if ('content' in entity && entity.content) {
    const contentText = extractContentText(entity.content)
    const searchableContent = caseSensitive ? contentText : contentText.toLowerCase()
    if (searchableContent.includes(searchQuery)) {
      matchedFields.push('content')
    }
  }

  // Check actions for content blocks (actions are now strings, need to resolve)
  const resolvedActions = extractActions(entity)
  if (resolvedActions) {
    for (const action of resolvedActions) {
      if (typeof action === 'object' && action !== null && 'content' in action) {
        const actionContentText = extractContentText(action.content)
        const searchableActionContent = caseSensitive
          ? actionContentText
          : actionContentText.toLowerCase()
        if (searchableActionContent.includes(searchQuery)) {
          matchedFields.push('actions.content')
          break // Only count once even if multiple actions match
        }
      }
    }
  }

  return {
    matches: matchedFields.length > 0,
    matchedFields,
  }
}

/**
 * Search across all or specific schemas
 */
export function search(options: SearchOptions): SearchResult[] {
  const { query, schemas: schemaFilter, limit, caseSensitive = false } = options

  if (!query.trim()) {
    return []
  }

  // Create cache key from search options
  const cacheKey = JSON.stringify(options)

  // Check cache first
  const cached = searchCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const results: SearchResult[] = []
  const schemaCatalog = getSchemaCatalog()
  const { dataMap } = getDataMaps()

  // Filter schemas if specified, and exclude meta schemas
  const schemasToSearch = (
    schemaFilter
      ? schemaCatalog.schemas.filter((s) => schemaFilter.includes(s.id as SURefEnumSchemaName))
      : schemaCatalog.schemas
  ).filter((s) => !s.meta)

  for (const schema of schemasToSearch) {
    const schemaId = schema.id as SURefEnumSchemaName
    const data = dataMap[schemaId]

    if (!data || !Array.isArray(data)) {
      continue
    }

    for (const entity of data as SURefEntity[]) {
      const { matches, matchedFields } = matchesQuery(entity, query, caseSensitive)

      if (matches) {
        const matchScore = calculateScore(entity, query, matchedFields)
        // Add schemaName to entity
        const entityWithSchema = { ...entity, schemaName: schemaId } as SURefEntity & {
          schemaName: SURefEnumSchemaName
        }

        results.push({
          schemaName: schemaId,
          schemaTitle: schema.title,
          entity: entityWithSchema,
          entityId: entity.id,
          entityName: entity.name,
          matchedFields,
          matchScore,
        })
      }
    }
  }

  // Sort by relevance score (highest first)
  results.sort((a, b) => b.matchScore - a.matchScore)

  // Apply limit after sorting
  const finalResults = limit && results.length > limit ? results.slice(0, limit) : results

  // Cache the results (with size management)
  searchCache.set(cacheKey, finalResults)
  trimCache()

  return finalResults
}

/**
 * Search within a specific schema
 */
export function searchIn<T extends SURefEntity>(
  schemaName: SURefEnumSchemaName,
  query: string,
  options?: { limit?: number; caseSensitive?: boolean }
): (T & { schemaName: SURefEnumSchemaName })[] {
  const results = search({
    query,
    schemas: [schemaName],
    limit: options?.limit,
    caseSensitive: options?.caseSensitive,
  })

  return results.map((r) => r.entity as T & { schemaName: SURefEnumSchemaName })
}

/**
 * Get search suggestions based on partial query
 * Returns unique entity names that match the query
 */
export function getSuggestions(
  query: string,
  options?: {
    schemas?: SURefEnumSchemaName[]
    limit?: number
    caseSensitive?: boolean
  }
): string[] {
  const results = search({
    query,
    schemas: options?.schemas,
    limit: options?.limit || 10,
    caseSensitive: options?.caseSensitive,
  })

  // Return unique names
  const names = new Set(results.map((r) => r.entityName))
  return Array.from(names)
}
