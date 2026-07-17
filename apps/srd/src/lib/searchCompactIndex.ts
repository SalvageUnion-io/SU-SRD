/**
 * Client-side matcher for the build-time compact search index
 * (`searchIndexTypes.ts` / `searchIndexBuild.ts`). Deliberately simpler than
 * `salvageunion-reference`'s ORM-backed `search()`: it matches against one
 * concatenated `text` field instead of per-field breakdown, so it drops
 * `matchedFields`-based scoring (never surfaced in the srd UI — the
 * only consumers, `SearchIsland`/`SearchResultsIsland`, don't render match
 * reasons) and the `+10` description-specific boost. It keeps the
 * name-priority scoring tiers and typo tolerance (`withinEditDistance1`,
 * ported from search.ts) so ranking/UX parity holds for the common cases.
 * This trade-off is what makes entity search fully decoupled from the ORM —
 * no preload, no `salvageunion-reference` import — at the cost of losing
 * fine-grained field-match ranking.
 */
import type { SearchOptions, SearchResult, SURefEnumSchemaName } from 'salvageunion-reference'
import type { CompactSearchEntry } from './searchIndexTypes'

/** Minimum token length before typo (edit-distance-1) matching applies —
 *  mirrors salvageunion-reference's search.ts. */
const TYPO_MIN_TOKEN_LENGTH = 4

/**
 * True when `token` is within edit distance 1 of `word` (insert, delete, or
 * substitute one character). Ported verbatim from search.ts so typo
 * tolerance behaves identically to the ORM-backed search.
 */
function withinEditDistance1(token: string, word: string): boolean {
  const lenDiff = token.length - word.length
  if (lenDiff < -1 || lenDiff > 1) return false
  let i = 0
  while (i < token.length && i < word.length && token[i] === word[i]) i++
  if (i === token.length && i === word.length) return true
  if (lenDiff === 0) return token.slice(i + 1) === word.slice(i + 1)
  if (lenDiff === 1) return token.slice(i + 1) === word.slice(i)
  return token.slice(i) === word.slice(i + 1)
}

/**
 * Search a compact index built by `searchIndexBuild.ts`. Same call/result
 * shape as `salvageunion-reference`'s `search()` (`SearchOptions` in,
 * `SearchResult[]` out) so it's a drop-in `searchFn` for
 * `useSearchCombobox`. `entity` on each result is a minimal stub
 * (`{ id, name, schemaName }`) — the only thing srd reads off it is
 * `getEntitySlug(entity)` (name-only), never the full entity shape.
 */
export function searchCompactIndex(
  index: readonly CompactSearchEntry[],
  options: SearchOptions
): SearchResult[] {
  const { query, schemas: schemaFilter, limit } = options
  const loweredQuery = query.trim().toLowerCase()
  if (!loweredQuery) return []
  const tokens = loweredQuery.split(/\s+/)
  const schemasToSearch = schemaFilter ? new Set(schemaFilter) : null

  const results: SearchResult[] = []

  for (const entry of index) {
    if (schemasToSearch && !schemasToSearch.has(entry.schemaName as SURefEnumSchemaName)) continue

    const nameText = entry.name.toLowerCase()
    let usedTypo = false
    let matches = true
    for (const token of tokens) {
      if (entry.text.includes(token)) continue
      if (token.length >= TYPO_MIN_TOKEN_LENGTH) {
        const nameWords = nameText.split(/[^a-z0-9]+/).filter(Boolean)
        if (nameWords.some((word) => withinEditDistance1(token, word))) {
          usedTypo = true
          continue
        }
      }
      matches = false
      break
    }
    if (!matches) continue

    let score = 0
    if (nameText === loweredQuery) score += 100
    else if (nameText.startsWith(loweredQuery)) score += 50
    else if (nameText.includes(loweredQuery)) score += 25
    else if (tokens.every((t) => nameText.includes(t))) score += 20
    if (usedTypo) score -= 15

    results.push({
      schemaName: entry.schemaName as SURefEnumSchemaName,
      schemaTitle: entry.schemaTitle,
      // Minimal stub — see doc comment above. `as` is intentional/narrow: the
      // full SURefEntity shape is never read by any srd consumer.
      entity: {
        id: entry.id,
        name: entry.name,
        schemaName: entry.schemaName,
      } as SearchResult['entity'],
      entityId: entry.id,
      entityName: entry.name,
      matchedFields: [],
      matchScore: score,
    })
  }

  results.sort((a, b) => b.matchScore - a.matchScore)
  return limit && results.length > limit ? results.slice(0, limit) : results
}
