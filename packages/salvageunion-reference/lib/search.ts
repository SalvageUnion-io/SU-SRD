/**
 * Search functionality for Salvage Union data
 */

import { extractActions, extractPatternActions } from './actionResolution'
import { getDataMaps, getSchemaCatalog } from './ModelFactory'
import { getPatterns } from './patterns'
import type { RefEntity, RefEnumSchemaName, RefMetaEntity } from './schemas/index'
import {
  matchSearchTokens,
  scoreSearchMatch,
  searchAliases,
  searchKindQuery,
  searchNameWords,
  searchSquashedName,
  searchWordStem,
  tokenizeSearchQuery,
} from './searchRanking'
import { SEARCH_NAMES_IT, searchNamesTerm, searchTermScore } from './searchTerms'
import { embeddedRollTableNames } from './topLevelRollTables'

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
 * The canonical implementation, and the ONLY one: every consumer imports this.
 *
 * `getSchemaCatalog()` reads the static schema index and needs no `preload()`,
 * so this is safe from any build-time or test context.
 */
export function isSchemaName(id: string): id is RefEnumSchemaName {
  indexableSchemaNames ??= new Set(
    getSchemaCatalog()
      .schemas.filter((s) => !s.meta)
      .map((s) => s.id)
  )
  return indexableSchemaNames.has(id)
}

export type SearchOptions = {
  query: string
  schemas?: RefEnumSchemaName[]
  limit?: number
}

// Cache for search results with size limit
const MAX_CACHE_SIZE = 100
const searchCache = new Map<string, SearchResult[]>()

// Lazy singleton search index
type SearchIndexEntry = {
  schemaName: RefEnumSchemaName
  schemaTitle: string
  entity: RefEntity & { schemaName: RefEnumSchemaName }
  entityId: string
  entityName: string
  nameText: string
  descriptionText: string
  goalsText: string
  assetsText: string
  weaknessesText: string
  contentText: string
  actionsText: string
  patternsText: string
  /** [fieldName, loweredText] pairs for every non-empty searchable field. */
  fields: ReadonlyArray<readonly [string, string]>
  /** Lowercased name words for bounded typo matching. */
  nameWords: string[]
  /** A roll table another record claims as its own (`embeddedRollTableNames`). */
  embedded: boolean
}

let searchIndex: SearchIndexEntry[] | null = null

/** Reset the lazy index — called by preload() so an index built before data
 *  loaded never survives a successful preload. */
export function invalidateSearchIndex(): void {
  searchIndex = null
  searchCache.clear()
}

/**
 * A host's PATTERNS as searchable text: each visible pattern's name, its prose,
 * and the rules of the actions it adds. A pattern has no row of its own, so it
 * is found through its host — "Hill Worm" finds Typhon, "Hauler" the Mule.
 * Shared with the reference site's compact index (`searchIndexBuild.ts`), which mirrors this.
 */
export function patternSearchText(entity: RefEntity): string {
  return (getPatterns(entity as RefMetaEntity) ?? [])
    .flatMap((pattern) => [
      pattern.name,
      extractContentText(pattern.content ?? []),
      ...extractPatternActions(pattern).map(
        (action) => `${action.name} ${extractContentText(action.content ?? [])}`
      ),
    ])
    .filter((part) => part.length > 0)
    .join(' ')
}

/**
 * The rules an entity holds beyond its opening text: a guide's steps (their
 * names and prose: "Heat Check" is a step of Heat) and a roll table's results
 * (their labels and prose: "Nailed it" is a result of the Core Mechanic).
 * Shared with the reference site's compact index, as `patternSearchText` is.
 */
export function rulesSearchText(entity: RefEntity): string {
  const record: Record<string, unknown> = entity
  const parts: string[] = []
  if (Array.isArray(record.steps)) {
    for (const step of record.steps as unknown[]) {
      if (typeof step !== 'object' || step === null) continue
      if ('name' in step && typeof step.name === 'string') parts.push(step.name)
      if ('content' in step) parts.push(extractContentText(step.content))
    }
  }
  const table = record.table
  if (typeof table === 'object' && table !== null) {
    // A result is an object (its label and prose); the table's `type` is not one.
    for (const row of Object.values(table)) {
      if (typeof row === 'object') parts.push(extractContentText(row))
    }
  }
  return parts.filter((part) => part.trim().length > 0).join(' ')
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
  // The roll tables another record prints as its own: ranked under that owner.
  const embedded = embeddedRollTableNames(
    Object.entries(dataMap).flatMap(([id, records]) => (id === 'roll-tables' ? [] : [records]))
  )

  for (const schema of schemasToIndex) {
    // Every non-meta catalog id is in the enum, so this guard is a runtime
    // no-op — but it narrows schema.id without an assertion.
    if (!isSchemaName(schema.id)) continue
    const schemaId = schema.id
    const data = dataMap[schemaId]

    if (!data || !Array.isArray(data)) {
      continue
    }

    for (const entity of data as RefEntity[]) {
      const entityWithSchema: RefEntity & { schemaName: RefEnumSchemaName } = {
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

      const patternsText = patternSearchText(entity).toLowerCase()
      const rulesText = rulesSearchText(entity).toLowerCase()

      // The name as it may be typed instead: without its punctuation
      // ("biotitan"), or by an alias ("sp").
      const nameForms = [nameText, searchSquashedName(nameText), ...searchAliases(nameText)]
      const fieldPairs: Array<readonly [string, string]> = [
        ['name', [...new Set(nameForms)].join(' ')],
      ]
      if (descriptionText) fieldPairs.push(['description', descriptionText])
      if (goalsText) fieldPairs.push(['goals', goalsText])
      if (assetsText) fieldPairs.push(['assets', assetsText])
      if (weaknessesText) fieldPairs.push(['weaknesses', weaknessesText])
      if (contentText) fieldPairs.push(['content', contentText])
      if (actionsText) fieldPairs.push(['actions.content', actionsText])
      if (patternsText) fieldPairs.push(['patterns', patternsText])
      if (rulesText) fieldPairs.push(['rules', rulesText])

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
        patternsText,
        fields: fieldPairs,
        nameWords: searchNameWords(nameText),
        embedded: schemaId === 'roll-tables' && embedded.has(entity.name),
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
  schemaName: RefEnumSchemaName
  schemaTitle: string
  entity: RefEntity & { schemaName: RefEnumSchemaName }
  entityId: string
  entityName: string
  matchedFields: string[]
  matchScore: number
}

/**
 * Extract all text from content blocks recursively.
 *
 * The canonical implementation of "flatten a ContentBlock tree to searchable
 * text"; `apps/web/src/lib/searchIndexBuild.ts` imports it.
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
 * the reference site's compact index (see `searchRanking.ts`).
 */
function matchedFieldsOf(indexEntry: SearchIndexEntry, tokens: string[]): string[] {
  const matchedFields: string[] = []
  for (const [fieldName, text] of indexEntry.fields) {
    if (tokens.some((token) => text.includes(token) || text.includes(searchWordStem(token))))
      matchedFields.push(fieldName)
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
  const { tokens } = parsed

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
        ...parsed,
        nameText: indexEntry.nameText,
        usedTypo,
        schemaName: indexEntry.schemaName,
        embedded: indexEntry.embedded,
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

  // "engineer class": the Engineer of the Classes listing, ranked as its
  // name, as on the site's compact index (r8 G1).
  const kind = searchKindQuery(parsed)
  if (kind && (!schemasToSearch || schemasToSearch.has(kind.schemaName))) {
    for (const hit of search({ query: kind.query, schemas: [kind.schemaName] })) {
      const found = results.find((result) => result.entityId === hit.entityId)
      if (found) found.matchScore = Math.max(found.matchScore, hit.matchScore)
      else results.push({ ...hit })
    }
  }

  // Nothing names the query: a rules term inside it leads, as on the site's
  // compact index (`searchNamesTerm`).
  if (!results.some((result) => result.matchScore >= SEARCH_NAMES_IT)) {
    for (const indexEntry of index) {
      if (schemasToSearch && !schemasToSearch.has(indexEntry.schemaName)) continue
      if (!searchNamesTerm(parsed, indexEntry.nameText, indexEntry.schemaName)) continue
      const holders = index.filter((other) =>
        other.fields.some(([, text]) => text.includes(indexEntry.nameText))
      ).length
      const matchScore = searchTermScore(indexEntry.schemaName, holders / index.length)
      const found = results.find((result) => result.entityId === indexEntry.entityId)
      if (found) {
        found.matchScore = Math.max(found.matchScore, matchScore)
        continue
      }
      results.push({
        schemaName: indexEntry.schemaName,
        schemaTitle: indexEntry.schemaTitle,
        entity: indexEntry.entity,
        entityId: indexEntry.entityId,
        entityName: indexEntry.entityName,
        matchedFields: ['name'],
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
export function searchIn<T extends RefEntity>(
  schemaName: RefEnumSchemaName,
  query: string,
  options?: { limit?: number }
): (T & { schemaName: RefEnumSchemaName })[] {
  const results = search({
    query,
    schemas: [schemaName],
    limit: options?.limit,
  })

  return results.map((r) => r.entity as T & { schemaName: RefEnumSchemaName })
}
