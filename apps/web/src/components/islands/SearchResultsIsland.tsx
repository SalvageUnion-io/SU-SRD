import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import { getEntitySlug } from 'salvageunion-reference'
import { space } from '../../design/tokens'
import { PROSE } from '../../lib/docPageStyles'
import { itemHref } from '../../lib/entityHref'
import { schemaPluralLabel } from '../../lib/schemaLabels'
import type { CompactSearchResult } from '../../lib/searchCompactIndex'
import { searchCompactIndex } from '../../lib/searchCompactIndex'
import { searchQuery } from '../../lib/searchHref'
import type { CompactSearchEntry } from '../../lib/searchIndexTypes'
import { useSearchIndex } from '../../lib/useSearchIndex'
import { islandsCopy } from '../../messages/components-islands'
import { clientSwap } from '../../runtime/clientSwap'
import { InlineRef } from '../atoms/InlineRef'
import { HeroSearchStatic } from '../HeroSearch'
import { Entity, Pending, SlabSection } from '../index'
import { DocumentLinks } from './DocumentLinks'
import { IslandErrorBoundary } from './IslandErrorBoundary'

/** Every match is listed up to here, as the search's own count stops (`useSearchCombobox`). */
const LIMIT = 200

/** A pattern's or a told rule's row groups under its kind, not its host's schema. */
const ROW_GROUPS: Record<string, string> = {
  Pattern: islandsCopy('patternsGroup'),
  Rule: islandsCopy('rulesGroup'),
}

/** The kind a result is grouped under: its schema's plural, or a pattern's or rule's own. */
function groupOf(result: CompactSearchResult): string {
  if (!result.pattern) return schemaPluralLabel(result.schemaName)
  const kind = result.pattern.kind.split(' · ')[0] ?? result.pattern.kind
  return ROW_GROUPS[kind] ?? kind
}

/** The results by kind, the kinds in the order their best match ranks. */
export function groupResults(
  results: readonly CompactSearchResult[]
): { kind: string; results: CompactSearchResult[] }[] {
  const groups = new Map<string, CompactSearchResult[]>()
  for (const result of results) {
    const kind = groupOf(result)
    const group = groups.get(kind)
    if (group) group.push(result)
    else groups.set(kind, [result])
  }
  return [...groups].map(([kind, rows]) => ({ kind, results: rows }))
}

/** A result's page: a pattern's or rule's own, else its schema's item page. */
function hrefOf(result: CompactSearchResult): string {
  return result.pattern?.href ?? itemHref(result.schemaName, getEntitySlug(result.entity))
}

/** Compacts one a line. */
const ROWS = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const LINE = { ...PROSE, margin: 0 } satisfies CSSProperties

/** The count, then each kind's section, a page's block gap apart (the island is one block). */
const SECTIONS = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[24],
} satisfies CSSProperties

type SearchResultsIslandProps = {
  /** The address's search string; defaults to `location.search`. Tests pass their own. */
  search?: string
}

/**
 * The search page (`/search/?q=shield`, r5 E3): every result for the query,
 * up to the search's count, grouped by kind, each kind a section with its
 * count and its results as link Compacts. It runs the same build-time index
 * as the Union bar's search (`/search-index.json`), on this page alone.
 */
export function SearchResultsIsland({ search }: SearchResultsIslandProps = {}) {
  const query = searchQuery(search ?? (typeof window === 'undefined' ? '' : window.location.search))
  const { ready, index } = useSearchIndex({ defer: !query })
  const results = useMemo(
    () => (ready && query ? searchCompactIndex(index, { query, limit: LIMIT }) : []),
    [ready, index, query]
  )
  const models = useMemo(
    () => new Map<string, CompactSearchEntry['model']>(index.map((e) => [e.id, e.model])),
    [index]
  )

  if (!query) return <p style={LINE}>{islandsCopy('searchForSomething')}</p>
  // What was searched for stays in a field of its own, to refine (RR6-02).
  const refine = <HeroSearchStatic query={query} shortcut="" />
  if (!ready)
    return (
      <div style={SECTIONS}>
        {refine}
        <Pending searching />
      </div>
    )

  if (results.length === 0) {
    return (
      <div style={SECTIONS}>
        {refine}
        <p style={LINE}>
          {islandsCopy('nothingCloseTo', { query })}. {islandsCopy('searchNoneBrowse')}{' '}
          <InlineRef href="/reference/">{islandsCopy('searchNoneListings')}</InlineRef>{' '}
          {islandsCopy('searchNoneOr')}{' '}
          <InlineRef href="/rules/">{islandsCopy('searchNoneRules')}</InlineRef>.
        </p>
      </div>
    )
  }

  const count = `${results.length}${results.length >= LIMIT ? '+' : ''}`
  return (
    <IslandErrorBoundary>
      <div style={SECTIONS}>
        {refine}
        <p style={LINE} aria-live="polite">
          {results.length === 1
            ? islandsCopy('oneResultFor', { query })
            : islandsCopy('resultsFor', { count, query })}
        </p>
        <DocumentLinks>
          {groupResults(results).map((group, i) => (
            <SlabSection
              key={group.kind}
              as="h2"
              id={`results-${i}`}
              title={group.kind}
              count={group.results.length}
              page
            >
              <ul style={ROWS}>
                {group.results.map((result) => {
                  const href = hrefOf(result)
                  const model = models.get(result.entityId)
                  return (
                    <li key={result.entityId}>
                      {model ? (
                        <Entity size="compact" model={model} mode={{ kind: 'link', href }} />
                      ) : (
                        <InlineRef href={href}>{result.entityName}</InlineRef>
                      )}
                    </li>
                  )
                })}
              </ul>
            </SlabSection>
          ))}
        </DocumentLinks>
      </div>
    </IslandErrorBoundary>
  )
}

/** The island as Astro hydrates it (`clientSwap`), over its server-rendered stand-in. */
export const SearchResultsIslandClient = clientSwap('SearchResultsIsland', SearchResultsIsland)
