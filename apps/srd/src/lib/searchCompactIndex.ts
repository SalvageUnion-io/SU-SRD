/**
 * Client-side matcher for the build-time compact search index
 * (`searchIndexTypes.ts` / `searchIndexBuild.ts`). Deliberately simpler than
 * `salvageunion-reference`'s ORM-backed `search()`: it matches against one
 * concatenated `text` field instead of per-field breakdown, so it drops
 * `matchedFields`-based scoring (never surfaced in the srd UI — the
 * only consumers, `SearchIsland`/`SearchResultsIsland`, don't render match
 * reasons) and the `+10` description-specific boost. It keeps the
 * name-priority scoring tiers and typo tolerance so ranking/UX parity holds
 * for the common cases. This trade-off is what keeps entity search decoupled
 * from the ORM — no preload, no entity corpus in the browser — at the cost of
 * losing fine-grained field-match ranking.
 *
 * `withinEditDistance1` / `TYPO_MIN_TOKEN_LENGTH` were forked into this file
 * (byte-for-byte, per the old comment here) to keep the import type-only. They
 * are now imported for real from `salvageunion-reference`, so typo-tolerance
 * parity with `search()` is structural rather than aspirational. Measured cost
 * on the srd bundle: **none**. Every consumer of this module —
 * `SearchIsland`, `SearchResultsIsland`, `MobileSearchIsland` — already
 * imports the shared `src` chunk, which already contained these functions;
 * moving to them shrank this chunk by 215 B and grew `src` by 8 B. The part
 * that actually mattered still holds: the browser never loads the entity
 * corpus, because matching runs against the fetched `/search-index.json`, not
 * an ORM `preload()`.
 */

import type { SearchOptions, SearchResult } from 'salvageunion-reference'
import { TYPO_MIN_TOKEN_LENGTH, withinEditDistance1 } from 'salvageunion-reference'
import type { CompactSearchEntry } from './searchIndexTypes'

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
    if (schemasToSearch && !schemasToSearch.has(entry.schemaName)) continue

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
      schemaName: entry.schemaName,
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
