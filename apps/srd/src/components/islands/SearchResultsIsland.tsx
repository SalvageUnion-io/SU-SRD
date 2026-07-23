import { useEffect, useMemo, useState } from 'react'
import { getEntitySlug } from 'salvageunion-reference'
import type { SearchResult } from 'salvageunion-reference'
import { Badge, FilterRow, SearchField } from 'component-lib'
import { useSearchIndex } from '../../lib/useSearchIndex'
import { searchCompactIndex } from '../../lib/searchCompactIndex'
import type { CompactSearchEntry } from '../../lib/searchIndexTypes'
import { IslandErrorBoundary } from './IslandErrorBoundary'

const PARAM_QUERY = 'q'

/** Read the `?q=` term from the current URL (window-guarded for safety). */
function readQueryParam(): string {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get(PARAM_QUERY) ?? ''
}

/** Right-hand schema label — 'Salvage Union ' prefix stripped, matching the combobox. */
function schemaLabel(result: SearchResult): string {
  return result.schemaTitle.replace('Salvage Union ', '')
}

/** Show-page URL for a result entity. Mirrors srdEntityHref / the combobox. */
function resultUrl(result: SearchResult): string {
  return `/schema/${result.schemaName}/item/${getEntitySlug(result.entity)}/`
}

/**
 * Full, uncapped search results for `/search?q=…`. Unlike the dropdown combobox
 * (capped at ~10 rows), this renders every hit and offers a lightweight
 * schema-type facet. Rendered `client:only` — it is inherently dynamic, has no
 * SEO content to server-render, and the page is `noindex`.
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
      <div className="mx-auto flex w-full max-w-[900px] flex-col gap-6">
        {/* biome-ignore lint/a11y/useSemanticElements: role="search" on <form> is the established search-landmark pattern; the <search> element is not a form, so swapping would change Enter-key submit semantics */}
        <form role="search" onSubmit={(e) => e.preventDefault()}>
          <SearchField
            type="search"
            name="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the SRD…"
            aria-label="Search the SRD"
            glyphSize={16}
            containerClassName="py-2 text-sm"
            autoFocus
          />
        </form>

        {ready ? (
          <SearchResults query={query} index={index} />
        ) : (
          <p className="text-sm text-ink-2">Loading search index…</p>
        )}
      </div>
    </IslandErrorBoundary>
  )
}

function SearchResults({ query, index }: { query: string; index: CompactSearchEntry[] }) {
  const trimmed = query.trim()
  const [schemaFacet, setSchemaFacet] = useState<string | null>(null)

  // Uncapped: no `limit`, so the full result set comes back.
  const results = useMemo(
    () => (trimmed ? searchCompactIndex(index, { query: trimmed }) : []),
    [trimmed, index]
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

  if (!trimmed) {
    return <p className="text-sm text-ink-2">Enter a search term to see results.</p>
  }

  if (results.length === 0) {
    return (
      <p className="text-sm text-ink-2" aria-live="polite">
        No results found for “{trimmed}”.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-2" aria-live="polite">
        {results.length} result{results.length === 1 ? '' : 's'} for “{trimmed}”
      </p>

      {facets.length > 1 && (
        <FilterRow label="Type">
          <Badge
            shape="chip"
            as="button"
            aria-pressed={activeFacet === null}
            surface={activeFacet === null ? 'solid' : 'ghost'}
            onClick={() => setSchemaFacet(null)}
          >
            All
          </Badge>
          {facets.map((f) => (
            <Badge
              key={f.schemaName}
              shape="chip"
              as="button"
              aria-pressed={activeFacet === f.schemaName}
              surface={activeFacet === f.schemaName ? 'solid' : 'ghost'}
              onClick={() => setSchemaFacet(f.schemaName)}
            >
              {`${f.label} (${f.count})`}
            </Badge>
          ))}
        </FilterRow>
      )}

      <ul className="flex flex-col divide-y divide-wk-faint rounded-card border border-wk-faint bg-paper">
        {visible.map((result) => (
          <li key={result.entityId}>
            <a
              href={resultUrl(result)}
              className="flex items-center justify-between gap-3 px-4 py-3 no-underline transition-colors hover:bg-wk-bg"
            >
              <span className="font-medium text-ink">{result.entityName}</span>
              <span className="shrink-0 font-cond text-xs uppercase tracking-wide text-ink-2">
                {schemaLabel(result)}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
