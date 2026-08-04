/**
 * Search functionality for Salvage Union data
 */

import type { SURefEntity, SURefEnumSchemaName } from './types/index.js'
import { getSchemaCatalog, getDataMaps } from './ModelFactory.js'
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
 * @public — the canonical implementation. `apps/discord-bot/src/schemaName.ts`
 * and `packages/component-lib/src/catalog/schemaName.ts` each carry a
 * byte-equivalent fork of it; they exist only because it was not exported.
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

export interface SearchOptions {
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
        nameWords: nameText.split(/[^a-z0-9]+/).filter(Boolean),
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
 * Extract all text from content blocks recursively.
 *
 * @public — the canonical implementation of "flatten a ContentBlock tree to
 * searchable text". `apps/srd/src/lib/searchIndexBuild.ts` carries a verbatim
 * fork (its own comment says so); it exists only because this was not exported.
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
 * True when `token` is within edit distance 1 of `word` (insert, delete, or
 * substitute one character). Two-pointer scan — no DP table, O(len) time.
 *
 * @public — the canonical typo-tolerance primitive. `apps/srd`'s
 * `searchCompactIndex.ts` carries a verbatim port (its own comment says
 * "ported verbatim from search.ts"); it exists only because this was not
 * exported. Ranking parity between the ORM-backed search and the compact
 * client index depends on the two behaving identically, which is exactly the
 * thing a fork cannot guarantee.
 */
export function withinEditDistance1(token: string, word: string): boolean {
  const lenDiff = token.length - word.length
  if (lenDiff < -1 || lenDiff > 1) return false
  // Walk both strings past the common prefix, then compare the remainder
  // according to which edit (substitute / insert / delete) could reconcile.
  let i = 0
  while (i < token.length && i < word.length && token[i] === word[i]) i++
  if (i === token.length && i === word.length) return true // identical
  if (lenDiff === 0) return token.slice(i + 1) === word.slice(i + 1) // substitute
  if (lenDiff === 1) return token.slice(i + 1) === word.slice(i) // delete from token
  return token.slice(i) === word.slice(i + 1) // insert into token
}

/**
 * Minimum token length before typo (edit-distance-1) matching applies.
 *
 * @public — paired with {@link withinEditDistance1}; `apps/srd`'s
 * `searchCompactIndex.ts` re-declares it, and a fork that drifts changes
 * ranking silently.
 */
export const TYPO_MIN_TOKEN_LENGTH = 4

/**
 * Calculate a relevance score for a search match.
 * Higher scores = better matches. Token-aware (audit item 11): whole-query
 * name hits rank above all-tokens-in-name, which ranks above hits scattered
 * across other fields; typo-assisted matches rank below every literal hit.
 */
function calculateScore(
  entry: SearchIndexEntry,
  loweredQuery: string,
  tokens: string[],
  matchedFields: string[],
  usedTypo: boolean
): number {
  let score = 0

  if (entry.nameText === loweredQuery) {
    score += 100
  } else if (entry.nameText.startsWith(loweredQuery)) {
    score += 50
  } else if (entry.nameText.includes(loweredQuery)) {
    score += 25
  } else if (tokens.every((t) => entry.nameText.includes(t))) {
    // All tokens appear in the name, just not contiguously ("heavy laser"
    // → "Heavy Arc Laser").
    score += 20
  }

  if (entry.descriptionText.includes(loweredQuery)) {
    score += 10
  }

  score += matchedFields.length * 5

  // A match that needed typo forgiveness always ranks below literal hits.
  if (usedTypo) score -= 15

  return score
}

/**
 * Check if an entity matches the tokenized query using the pre-computed
 * index. Every token must match somewhere (substring across any field, or —
 * for tokens of 4+ chars — edit-distance-1 against a name word). matchedFields
 * lists every field containing at least one token.
 */
function matchesQuery(
  indexEntry: SearchIndexEntry,
  tokens: string[]
): { matches: boolean; matchedFields: string[]; usedTypo: boolean } {
  const matchedFields: string[] = []
  let usedTypo = false

  // Which fields contain at least one token (drives matchedFields)?
  for (const [fieldName, text] of indexEntry.fields) {
    for (const token of tokens) {
      if (text.includes(token)) {
        matchedFields.push(fieldName)
        break
      }
    }
  }

  // AND semantics: every token must land somewhere.
  for (const token of tokens) {
    let found = false
    for (const [, text] of indexEntry.fields) {
      if (text.includes(token)) {
        found = true
        break
      }
    }
    if (!found && token.length >= TYPO_MIN_TOKEN_LENGTH) {
      // Name-only typo forgiveness: "hellfyre" → "Hellfire".
      if (indexEntry.nameWords.some((word) => withinEditDistance1(token, word))) {
        found = true
        usedTypo = true
        if (!matchedFields.includes('name')) matchedFields.push('name')
      }
    }
    if (!found) {
      return { matches: false, matchedFields: [], usedTypo: false }
    }
  }

  return { matches: matchedFields.length > 0, matchedFields, usedTypo }
}

/**
 * Search across all or specific schemas
 */
export function search(options: SearchOptions): SearchResult[] {
  const { query, schemas: schemaFilter, limit } = options

  const loweredQuery = query.trim().toLowerCase()
  if (!loweredQuery) {
    return []
  }
  const tokens = loweredQuery.split(/\s+/)

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

    const { matches, matchedFields, usedTypo } = matchesQuery(indexEntry, tokens)

    if (matches) {
      const matchScore = calculateScore(indexEntry, loweredQuery, tokens, matchedFields, usedTypo)

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
