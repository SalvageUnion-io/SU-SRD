import {
  EmptyState,
  Entity,
  SearchField,
  Segmented,
  SegmentedOption,
  Skeleton,
  schemaPluralLabel,
} from 'component-lib'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import type { SearchResult } from 'salvageunion-reference'
import { getEntitySlug } from 'salvageunion-reference'
import { itemHref } from '../../lib/entityHref'
import { searchCompactIndex } from '../../lib/searchCompactIndex'
import type { CompactSearchEntry } from '../../lib/searchIndexTypes'
import { useSearchIndex } from '../../lib/useSearchIndex'
import { IslandErrorBoundary } from './IslandErrorBoundary'

const PARAM_QUERY = 'q'

/** Read the `?q=` term from the current URL (window-guarded for safety). */
function readQueryParam(): string {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get(PARAM_QUERY) ?? ''
}

/** Right-hand schema label — the authored plural, matching the combobox. */
function schemaLabel(result: SearchResult): string {
  return schemaPluralLabel(result.schemaName)
}

/** Show-page URL for a result entity. Mirrors srdEntityHref / the combobox. */
function resultUrl(result: SearchResult): string {
  return itemHref(result.schemaName, getEntitySlug(result.entity))
}

/**
 * Full, uncapped search results for `/search?q=…`. Unlike the dropdown combobox
 * (capped at ~10 rows), this renders every hit and offers a lightweight
 * schema-type facet. Rendered `client="only"` with `ssr={false}` — it is
 * inherently dynamic, has no SEO content to server-render, and the page is
 * `noindex`.
 */
export function SearchResultsIsland() {
  const [query, setQuery] = useState(() => readQueryParam())
  const { ready, index } = useSearchIndex()

  // Keep the URL in sync with the editable input so the page stays shareable
  // (replaceState — don't spam history on each keystroke).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const term = query.trim()
    if (term) params.set(PARAM_QUERY, term)
    else params.delete(PARAM_QUERY)
    const qs = params.toString()
    const nextUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    const currentUrl = `${window.location.pathname}${window.location.search}`
    if (nextUrl !== currentUrl) {
      window.history.replaceState(window.history.state, '', nextUrl)
    }
  }, [query])

  return (
    <IslandErrorBoundary>
      {/* Mixed kinds, chassis among them: the wide listing's column. */}
      <div className="srd-listing" data-wide="">
        <SearchResults query={query} setQuery={setQuery} ready={ready} index={index} />
      </div>
    </IslandErrorBoundary>
  )
}

type QueryProps = { query: string; setQuery: (query: string) => void }

/** The listing's rail: the search box, then (with results) the type facet. */
function SearchRail({ query, setQuery, children }: QueryProps & { children?: ReactNode }) {
  return (
    <div className="srd-rail">
      {/* biome-ignore lint/a11y/useSemanticElements: role="search" on <form> is the established search-landmark pattern; the <search> element is not a form, so swapping would change Enter-key submit semantics */}
      <form role="search" className="srd-rail__search" onSubmit={(e) => e.preventDefault()}>
        <SearchField
          type="search"
          name="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the SRD…"
          aria-label="Search the SRD"
          containerClassName="srd-rail__field"
          glyphSize={18}
          autoFocus
        />
      </form>
      <span className="srd-rail__spring" />
      {children}
    </div>
  )
}

/** The rail, then the hits; the rail stays mounted while the index loads. */
function SearchResults({
  query,
  setQuery,
  ready,
  index,
}: QueryProps & { ready: boolean; index: CompactSearchEntry[] }) {
  const trimmed = query.trim()
  const [schemaFacet, setSchemaFacet] = useState<string | null>(null)

  // Uncapped: no `limit`, so the full result set comes back.
  const results = useMemo(
    () => (trimmed && ready ? searchCompactIndex(index, { query: trimmed }) : []),
    [trimmed, ready, index]
  )

  // Facet options: distinct schemas present in the current result set, with counts.
  const facets = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>()
    for (const r of results) {
      const existing = counts.get(r.schemaName)
      if (existing) existing.count += 1
      else counts.set(r.schemaName, { label: schemaLabel(r), count: 1 })
    }
    return [...counts.entries()].map(([schemaName, { label, count }]) => ({
      schemaName,
      label,
      count,
    }))
  }, [results])

  // A facet is only valid while it still appears in the results; drop it otherwise.
  const activeFacet =
    schemaFacet && facets.some((f) => f.schemaName === schemaFacet) ? schemaFacet : null

  const visible = activeFacet ? results.filter((r) => r.schemaName === activeFacet) : results
  const models = useMemo(() => new Map(index.map((entry) => [entry.id, entry.model])), [index])

  const rail = (
    <SearchRail query={query} setQuery={setQuery}>
      {facets.length > 1 && (
        <Segmented label="Type">
          <SegmentedOption pressed={activeFacet === null} onClick={() => setSchemaFacet(null)}>
            All
          </SegmentedOption>
          {facets.map((f) => (
            <SegmentedOption
              key={f.schemaName}
              pressed={activeFacet === f.schemaName}
              onClick={() => setSchemaFacet(f.schemaName)}
            >
              {`${f.label} (${f.count})`}
            </SegmentedOption>
          ))}
        </Segmented>
      )}
    </SearchRail>
  )

  if (!ready) {
    return (
      <>
        {rail}
        <ul className="srd-listing__cards" data-entity-grid="" data-entity-fit="">
          {Array.from({ length: 4 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static 4-item skeleton placeholder list, never reordered — index is stable
            <li key={i}>
              <Skeleton />
            </li>
          ))}
        </ul>
      </>
    )
  }

  if (!trimmed) {
    return (
      <>
        {rail}
        <EmptyState headline="Search the SRD" body="Enter a search term to see results." />
      </>
    )
  }

  if (results.length === 0) {
    return (
      <>
        {rail}
        <output aria-live="polite">
          <EmptyState headline="Nothing here" body={`No results found for “${trimmed}”.`} />
        </output>
      </>
    )
  }

  return (
    <>
      {rail}
      <output className="srd-rail__status" aria-live="polite">
        <span className="srd-rail__tally">
          {results.length} result{results.length === 1 ? '' : 's'} for “{trimmed}”
        </span>
      </output>

      {/* SEARCH (ruleset §1.5, entity display language E11): every result is
          a listing Row in link mode, with the lead, as a schema listing's. */}
      <ul className="srd-listing__cards" data-entity-grid="" data-entity-fit="">
        {visible.map((result) => {
          const model = models.get(result.entityId)
          return (
            <li key={result.entityId}>
              {model ? (
                <Entity
                  form="row"
                  model={model}
                  mode={{ kind: 'link', href: resultUrl(result) }}
                  lead
                />
              ) : (
                <a href={resultUrl(result)} className="srd-listing__fallback-row">
                  {result.entityName}
                </a>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
