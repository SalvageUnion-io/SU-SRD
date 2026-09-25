/**
 * Client-side matcher for the build-time compact search index
 * (`searchIndexTypes.ts` / `searchIndexBuild.ts`). It matches against one
 * concatenated `text` field rather than the ORM's per-field breakdown, which is
 * what keeps entity search decoupled from the ORM — no preload, no entity
 * corpus in the browser; matching runs against the fetched
 * `/search-index.json`.
 *
 * The matching and ranking RULES are not implemented here. Tokenising, the
 * AND-of-tokens rule with its name-only typo forgiveness, and the name-priority
 * score tiers all come from `salvageunion-reference`'s `searchRanking.ts`, the
 * same functions the ORM `search()` calls (audit PK-11 — this file used to
 * re-implement the tiers inline). What differs is only the facts this matcher
 * has: with no per-field text it passes no description and no matched-field
 * count, so the ORM's `+10` description boost and `+5`-per-field refinement do
 * not apply. Neither is surfaced in the srd UI, which renders no match reasons.
 *
 * Those functions import nothing from the ORM, so the browser still never
 * loads the corpus.
 */

import type { SearchOptions, SearchResult } from 'salvageunion-reference'
import {
  matchSearchTokens,
  scoreSearchMatch,
  searchNameWords,
  tokenizeSearchQuery,
} from 'salvageunion-reference'
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
  const parsed = tokenizeSearchQuery(query)
  if (!parsed) return []
  const { loweredQuery, tokens } = parsed
  const schemasToSearch = schemaFilter ? new Set(schemaFilter) : null

  const results: SearchResult[] = []

  for (const entry of index) {
    if (schemasToSearch && !schemasToSearch.has(entry.schemaName)) continue

    const nameText = entry.name.toLowerCase()
    const { matches, usedTypo } = matchSearchTokens(tokens, searchNameWords(nameText), (token) =>
      entry.text.includes(token)
    )
    if (!matches) continue

    const score = scoreSearchMatch({ nameText, loweredQuery, tokens, usedTypo })

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
