import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import type { SearchResult } from 'salvageunion-reference'
import { getEntitySlug } from 'salvageunion-reference'
import { itemHref } from '../../lib/entityHref'
import { searchCompactIndex } from '../../lib/searchCompactIndex'
import type { CompactSearchEntry } from '../../lib/searchIndexTypes'
import { useSearchIndex } from '../../lib/useSearchIndex'
import { Entity, Slab } from '../index'
import { IslandErrorBoundary } from './IslandErrorBoundary'

/** The section's slab: the section's own gap spaces it. */
const SLAB = { marginBottom: 0 } satisfies CSSProperties

/** How many guesses the 404 offers. */
const LIMIT = 5

/**
 * The site's own path words (the JSON API's `schema` and `item`, a pattern page's
 * `pattern`), never part of what the reader was looking for
 * (`404` is the page itself, opened directly).
 */
const STRUCTURAL = new Set(['schema', 'item', 'pattern', '404'])

/**
 * The search term a missed URL implies: its last meaningful segment, a slug
 * turned back into words (`/chassis/mule-mk2/` → `mule mk2`).
 * Empty when the path holds nothing to search for (`/`, `/schema/item/`).
 */
export function queryFromPathname(pathname: string): string {
  const segments = pathname
    .split('/')
    .map((segment) => {
      try {
        return decodeURIComponent(segment)
      } catch {
        return segment
      }
    })
    .map((segment) =>
      segment
        .replace(/\.html?$/i, '')
        .replace(/[-_+.]+/g, ' ')
        .trim()
    )
    .filter((segment) => segment && !STRUCTURAL.has(segment.toLowerCase()))
  return segments.at(-1) ?? ''
}

/**
 * The guesses for a term: the whole term first, as the SRD search reads it
 * (every word must match). A slug with one wrong word matches nothing that
 * way, so failing that, the longest single word that matches anything.
 */
export function guessesFor(index: readonly CompactSearchEntry[], query: string): SearchResult[] {
  const whole = searchCompactIndex(index, { query, limit: LIMIT })
  if (whole.length > 0) return whole
  const words = query
    .split(/\s+/)
    .filter((word) => word.length >= 3)
    .sort((a, b) => b.length - a.length)
  for (const word of words) {
    const results = searchCompactIndex(index, { query: word, limit: LIMIT })
    if (results.length > 0) return results
  }
  return []
}

type DidYouMeanIslandProps = {
  /** The missed path; defaults to `location.pathname`. Tests pass their own. */
  pathname?: string
}

/**
 * The 404's "did you mean": the missed URL's slug, read back as a search term
 * and run against the same build-time index the SRD search uses
 * (`/search-index.json`), its closest entries as search-result Rows. No
 * props on the page: the path is only known in the browser, since every miss
 * is answered with the one `404.html`.
 */
export function DidYouMeanIsland({ pathname }: DidYouMeanIslandProps = {}) {
  const query = queryFromPathname(
    pathname ?? (typeof window === 'undefined' ? '' : window.location.pathname)
  )
  const { ready, index } = useSearchIndex({ defer: !query })
  const guesses = useMemo(
    () => (ready && query ? guessesFor(index, query) : []),
    [ready, index, query]
  )
  const models = useMemo(() => new Map(index.map((entry) => [entry.id, entry.model])), [index])

  if (!query || !ready) return null

  const searchHref = `/search/?q=${encodeURIComponent(query)}`

  return (
    <IslandErrorBoundary>
      <section className="srd-not-found__guesses" aria-labelledby="did-you-mean">
        <Slab
          variant="solid"
          as="h2"
          id="did-you-mean"
          style={SLAB}
          label={guesses.length > 0 ? 'Did you mean' : `Nothing close to “${query}”`}
        />
        {guesses.length > 0 && (
          <ul className="srd-not-found__results">
            {guesses.map((result) => {
              const href = itemHref(result.schemaName, getEntitySlug(result.entity))
              const model = models.get(result.entityId)
              return (
                <li key={result.entityId}>
                  {model ? (
                    <Entity form="row" model={model} mode={{ kind: 'link', href }} />
                  ) : (
                    <a href={href} className="srd-not-found__link">
                      {result.entityName}
                    </a>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <a href={searchHref} className="srd-not-found__link">
          Search the SRD for “{query}”
        </a>
      </section>
    </IslandErrorBoundary>
  )
}
