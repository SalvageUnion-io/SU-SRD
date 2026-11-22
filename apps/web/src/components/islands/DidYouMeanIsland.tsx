import { useMemo } from 'react'
import type { SearchResult } from 'salvageunion-reference'
import { getEntitySlug } from 'salvageunion-reference'
import { itemHref } from '../../lib/entityHref'
import { ancestorOf, listingGuessesFor } from '../../lib/listingGuesses'
import { searchCompactIndex } from '../../lib/searchCompactIndex'
import { searchHref } from '../../lib/searchHref'
import type { CompactSearchEntry } from '../../lib/searchIndexTypes'
import { useSearchIndex } from '../../lib/useSearchIndex'
import { islandsCopy } from '../../messages/components-islands'
import { clientSwap } from '../../runtime/clientSwap'
import { Entity, SlabSection } from '../index'
import { DocumentLinks } from './DocumentLinks'
import { IslandErrorBoundary } from './IslandErrorBoundary'

/** The section's slab: the section's own gap spaces it. */
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
 * way, so failing that, the longest single word that matches anything. The
 * section the address names leads (`/chassis/mulee/`: the Mule before Melee,
 * RR6-07): its entries first, in the search's order, then the rest.
 */
export function guessesFor(
  index: readonly CompactSearchEntry[],
  query: string,
  section?: string
): SearchResult[] {
  // A wider net when a section reorders it, so its entry is in the catch.
  const limit = section ? LIMIT * 4 : LIMIT
  const ranked = (results: SearchResult[]) =>
    section
      ? [
          ...results.filter((result) => result.schemaName === section),
          ...results.filter((result) => result.schemaName !== section),
        ].slice(0, LIMIT)
      : results
  const whole = searchCompactIndex(index, { query, limit })
  if (whole.length > 0) return ranked(whole)
  const words = query
    .split(/\s+/)
    .filter((word) => word.length >= 3)
    .sort((a, b) => b.length - a.length)
  for (const word of words) {
    const results = searchCompactIndex(index, { query: word, limit })
    if (results.length > 0) return ranked(results)
  }
  return []
}

/** The section a missed address names, where its first segment is a kind the index holds. */
function sectionOf(index: readonly CompactSearchEntry[], pathname: string): string | undefined {
  const [first] = pathname.split('/').filter(Boolean)
  return first && index.some((entry) => entry.schemaName === first) ? first : undefined
}

type DidYouMeanIslandProps = {
  /** The missed path; defaults to `location.pathname`. Tests pass their own. */
  pathname?: string
}

/**
 * The 404's "did you mean": the missed URL's slug, read back as a search term
 * and run against the same build-time index the SRD search uses
 * (`/search-index.json`), its closest entries as search-result Compacts. No
 * props on the page: the path is only known in the browser, since every miss
 * is answered with the one `404.html`.
 */
export function DidYouMeanIsland({ pathname }: DidYouMeanIslandProps = {}) {
  const missed = pathname ?? (typeof window === 'undefined' ? '' : window.location.pathname)
  const query = queryFromPathname(missed)
  const { ready, index } = useSearchIndex({ defer: !query })
  // The listings the address names (`/chasis/`, `/chassis/atlas/patterns/`).
  const listings = useMemo(() => (query ? listingGuessesFor(missed) : []), [missed, query])
  const guesses = useMemo(() => {
    if (!ready || !query) return []
    const found = guessesFor(index, query, sectionOf(index, missed))
    // The entry a deeper miss sits under leads the guesses: the page the
    // reader was on the way to.
    const above = ancestorOf(missed)
    const parent = above
      ? index.find(
          (entry) =>
            !entry.pattern && entry.schemaName === above.schemaId && entry.slug === above.slug
        )
      : undefined
    if (!parent) return found
    const lead = searchCompactIndex(index, { query: parent.name, limit: 20 }).find(
      (result) => result.entityId === parent.id
    )
    return lead
      ? [lead, ...found.filter((result) => result.entityId !== lead.entityId)].slice(0, LIMIT)
      : found
  }, [ready, index, query, missed])
  const models = useMemo(() => new Map(index.map((entry) => [entry.id, entry.model])), [index])

  if (!query || !ready) return null

  // The Reference page's search, opened on the query (`SearchIsland`'s bar).
  const searchHere = searchHref(query)

  return (
    <IslandErrorBoundary>
      <SlabSection
        as="h2"
        id="did-you-mean"
        title={
          guesses.length > 0 || listings.length > 0
            ? islandsCopy('didYouMean')
            : islandsCopy('nothingCloseTo', { query })
        }
        page
        bodyClassName="su-not-found__guesses"
      >
        {listings.length > 0 && (
          // The listing itself, first: a mistyped listing is the commonest miss.
          <ul className="su-not-found__results">
            {listings.map((listing) => (
              <li key={listing.schemaId}>
                <a href={listing.href} className="su-not-found__link">
                  {islandsCopy('allOfListing', { name: listing.label })}
                </a>
              </li>
            ))}
          </ul>
        )}
        {guesses.length > 0 && (
          <DocumentLinks>
            <ul className="su-not-found__results">
              {guesses.map((result) => {
                const href = itemHref(result.schemaName, getEntitySlug(result.entity))
                const model = models.get(result.entityId)
                return (
                  <li key={result.entityId}>
                    {model ? (
                      <Entity size="compact" model={model} mode={{ kind: 'link', href }} />
                    ) : (
                      <a href={href} className="su-not-found__link">
                        {result.entityName}
                      </a>
                    )}
                  </li>
                )
              })}
            </ul>
          </DocumentLinks>
        )}
        <a href={searchHere} className="su-not-found__link">
          {islandsCopy('searchTheReferenceFor', { query })}
        </a>
      </SlabSection>
    </IslandErrorBoundary>
  )
}

/** The island as Astro hydrates it: `DidYouMeanIsland` swapped in over its stand-in (`clientSwap`). */
export const DidYouMeanIslandClient = clientSwap('DidYouMeanIsland', DidYouMeanIsland)
