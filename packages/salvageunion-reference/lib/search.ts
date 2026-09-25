/**
 * Search functionality for Salvage Union data
 */

import { getDataMaps, getSchemaCatalog } from './ModelFactory.js'
import {
  matchSearchTokens,
  scoreSearchMatch,
  searchNameWords,
  tokenizeSearchQuery,
} from './searchRanking.js'
import type { SURefEntity, SURefEnumSchemaName } from './types/index.js'
import { extractActions } from './utilities.js'

/** Lazily-built membership set: the non-meta schema catalog ids. */
let indexableSchemaNames: ReadonlySet<string> | null = null

/**
 * Type guard: is this string a canonical, indexable schema name?
 *
 * Membership is the NON-META schema catalog — exactly the set entity pages, the
 * search index and catalog tiles are generated from, and a strict subset of the
 * `SchemaNameSchema` enum (which also carries the meta-only
 * `ability-tree-requirements`). Narrowing on the catalog rather than the enum is
 * what makes this usable as an untrusted-input guard.
 *
 * The canonical implementation, and now the ONLY one. Two byte-equivalent
 * forks used to exist — `apps/discord-bot/src/schemaName.ts` and
 * `packages/component-lib/src/catalog/schemaName.ts` — created only because
 * this was not exported. Both files are gone; every consumer imports this.
 *
 * `getSchemaCatalog()` reads the static schema index and needs no `preload()`,
 * so this is safe from any build-time or test context.
 */
export function isSchemaName(id: string): id is SURefEnumSchemaName {
  indexableSchemaNames ??= new Set(
    getSchemaCatalog()
      .schemas.filter((s) => !s.meta)
      .map((s) => s.id)
  )
  return indexableSchemaNames.has(id)
}

export type SearchOptions = {
  query: string
  schemas?: SURefEnumSchemaName[]
  limit?: number
}

// Cache for search results with size limit
const MAX_CACHE_SIZE = 100
const searchCache = new Map<string, SearchResult[]>()

// Lazy singleton search index
type SearchIndexEntry = {
  schemaName: SURefEnumSchemaName
  schemaTitle: string
  entity: SURefEntity & { schemaName: SURefEnumSchemaName }
  entityId: string
  entityName: string
  nameText: string
  descriptionText: string
  goalsText: string
  assetsText: string
  weaknessesText: string
  contentText: string
  actionsText: string
  /** [fieldName, loweredText] pairs for every non-empty searchable field. */
  fields: ReadonlyArray<readonly [string, string]>
  /** Lowercased name words for bounded typo matching. */
  nameWords: string[]
}

let searchIndex: SearchIndexEntry[] | null = null

/** Reset the lazy index — called by preload() so an index built before data
 *  loaded never survives a successful preload. */
export function invalidateSearchIndex(): void {
  searchIndex = null
  searchCache.clear()
}

/**
 * Build the search index lazily on first access
 * Pre-computes searchable text for all entities
 */
function buildSearchIndex(): SearchIndexEntry[] {
  const entries: SearchIndexEntry[] = []
  const schemaCatalog = getSchemaCatalog()
  const { dataMap } = getDataMaps()

  const schemasToIndex = schemaCatalog.schemas.filter((s) => !s.meta)

  for (const schema of schemasToIndex) {
    // Every non-meta catalog id is in the enum, so this guard is a runtime
    // no-op — but it narrows schema.id without an assertion.
    if (!isSchemaName(schema.id)) continue
    const schemaId = schema.id
    const data = dataMap[schemaId]

    if (!data || !Array.isArray(data)) {
      continue
    }

    for (const entity of data as SURefEntity[]) {
      const entityWithSchema: SURefEntity & { schemaName: SURefEnumSchemaName } = {
        ...entity,
        schemaName: schemaId,
      }

      const resolvedActions = extractActions(entity)
      const actionsText = resolvedActions
        ? resolvedActions
            .map((action) =>
              typeof action === 'object' && action !== null && 'content' in action
                ? extractContentText(action.content)
                : ''
            )
            .join(' ')
            .toLowerCase()
        : ''

      const nameText = entity.name.toLowerCase()
      const descriptionText =
        'description' in entity && typeof entity.description === 'string'
          ? entity.description.toLowerCase()
          : ''
      const goalsText =
        'goals' in entity && typeof entity.goals === 'string' ? entity.goals.toLowerCase() : ''
      const assetsText =
        'assets' in entity && typeof entity.assets === 'string' ? entity.assets.toLowerCase() : ''
      const weaknessesText =
        'weaknesses' in entity && typeof entity.weaknesses === 'string'
          ? entity.weaknesses.toLowerCase()
          : ''
      const contentText =
        'content' in entity && entity.content
          ? extractContentText(entity.content).toLowerCase()
          : ''

      const fieldPairs: Array<readonly [string, string]> = [['name', nameText]]
      if (descriptionText) fieldPairs.push(['description', descriptionText])
      if (goalsText) fieldPairs.push(['goals', goalsText])
      if (assetsText) fieldPairs.push(['assets', assetsText])
      if (weaknessesText) fieldPairs.push(['weaknesses', weaknessesText])
      if (contentText) fieldPairs.push(['content', contentText])
      if (actionsText) fieldPairs.push(['actions.content', actionsText])

      entries.push({
        schemaName: schemaId,
        schemaTitle: schema.title,
        entity: entityWithSchema,
        entityId: entity.id,
        entityName: entity.name,
        nameText,
        descriptionText,
        goalsText,
        assetsText,
        weaknessesText,
        contentText,
        actionsText,
        fields: fieldPairs,
        nameWords: searchNameWords(nameText),
      })
    }
  }

  return entries
}

/**
 * Get the search index, building it lazily on first access
 */
function getSearchIndex(): SearchIndexEntry[] {
  if (searchIndex === null) {
    searchIndex = buildSearchIndex()
  }
  return searchIndex
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

export type SearchResult = {
  schemaName: SURefEnumSchemaName
  schemaTitle: string
  entity: SURefEntity & { schemaName: SURefEnumSchemaName }
  entityId: string
  entityName: string
  matchedFields: string[]
  matchScore: number
}

/**
 * Extract all text from content blocks recursively.
 *
 * The canonical implementation of "flatten a ContentBlock tree to searchable
 * text". `apps/srd/src/lib/searchIndexBuild.ts` used to carry a verbatim fork;
 * it now imports this one.
 */
export function extractContentText(content: unknown): string {
  if (!content) return ''

  if (Array.isArray(content)) {
    return content.map(extractContentText).join(' ')
  }

  if (typeof content === 'object' && content !== null) {
    let text = ''

    // Extract value field
    if ('value' in content && typeof content.value === 'string') {
      text += `${content.value} `
    }

    // Extract label field
    if ('label' in content && typeof content.label === 'string') {
      text += `${content.label} `
    }

    // Recursively extract from nested items
    if ('items' in content && Array.isArray(content.items)) {
      text += extractContentText(content.items)
    }

    return text
  }

  return ''
}

/**
 * Which fields of an entry hold at least one token. Drives the per-field part
 * of the score; the match decision itself is `matchSearchTokens`, shared with
 * srd's compact index (see `searchRanking.ts`).
 */
function matchedFieldsOf(indexEntry: SearchIndexEntry, tokens: string[]): string[] {
  const matchedFields: string[] = []
  for (const [fieldName, text] of indexEntry.fields) {
    if (tokens.some((token) => text.includes(token))) matchedFields.push(fieldName)
  }
  return matchedFields
}

/**
 * Search across all or specific schemas
 */
export function search(options: SearchOptions): SearchResult[] {
  const { query, schemas: schemaFilter, limit } = options

  const parsed = tokenizeSearchQuery(query)
  if (!parsed) {
    return []
  }
  const { loweredQuery, tokens } = parsed

  // Create cache key from search options
  const cacheKey = JSON.stringify(options)

  // Check cache first
  const cached = searchCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const results: SearchResult[] = []
  const index = getSearchIndex()

  // Create a set of schemas to search for O(1) lookup
  const schemasToSearch = schemaFilter ? new Set(schemaFilter) : null

  // Iterate through the pre-built index
  for (const indexEntry of index) {
    // Skip if schema filter is specified and this schema is not in the filter
    if (schemasToSearch && !schemasToSearch.has(indexEntry.schemaName)) {
      continue
    }

    // AND semantics: every token must land in some field, or — name-only —
    // within one typo of a name word.
    const { matches, usedTypo } = matchSearchTokens(tokens, indexEntry.nameWords, (token) =>
      indexEntry.fields.some(([, text]) => text.includes(token))
    )

    if (matches) {
      const matchedFields = matchedFieldsOf(indexEntry, tokens)
      if (usedTypo && !matchedFields.includes('name')) matchedFields.push('name')
      const matchScore = scoreSearchMatch({
        nameText: indexEntry.nameText,
        loweredQuery,
        tokens,
        usedTypo,
        descriptionText: indexEntry.descriptionText,
        matchedFieldCount: matchedFields.length,
      })

      results.push({
        schemaName: indexEntry.schemaName,
        schemaTitle: indexEntry.schemaTitle,
        entity: indexEntry.entity,
        entityId: indexEntry.entityId,
        entityName: indexEntry.entityName,
        matchedFields,
        matchScore,
      })
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
  options?: { limit?: number }
): (T & { schemaName: SURefEnumSchemaName })[] {
  const results = search({
    query,
    schemas: [schemaName],
    limit: options?.limit,
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
  }
): string[] {
  const results = search({
    query,
    schemas: options?.schemas,
    limit: options?.limit || 10,
  })

  // Return unique names
  const names = new Set(results.map((r) => r.entityName))
  return Array.from(names)
}
