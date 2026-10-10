import type { SearchComboboxResult } from 'component-lib'
import { SearchField, useSearchCombobox } from 'component-lib'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getEntitySlug } from 'salvageunion-reference'
import { itemHref, schemaHref } from '../../lib/entityHref'
import { searchCompactIndex } from '../../lib/searchCompactIndex'
import { useSearchIndex } from '../../lib/useSearchIndex'
import { HERO_SEARCH_PLACEHOLDER, HeroSearchForm } from '../HeroSearch'
import { IslandErrorBoundary } from './IslandErrorBoundary'

type SearchIslandProps = {
  /** Injectable navigation function — defaults to window.location.assign.
   *  Override in tests to spy on navigation without happy-dom limitations. */
  navigate?: (url: string) => void
  /**
   * `bar` (default) — the Union bar's compact field. `hero` — the home page's
   * wide field and Search button on the Contents band (board 06), over the
   * same `HeroSearchForm` the page server-renders.
   */
  variant?: 'bar' | 'hero'
}

/** Site URL for a combobox result: category listing or entity item page. */
function resultUrl(result: SearchComboboxResult): string {
  if (result.kind === 'schema') return schemaHref(result.schemaId)
  return itemHref(result.schemaId, getEntitySlug(result.entity))
}

export function SearchIsland({ navigate, variant = 'bar' }: SearchIslandProps = {}) {
  const hero = variant === 'hero'
  // Deferred: the compact search index doesn't download until first user
  // intent (focusing the input or typing) — keeps it off every page's
  // critical path. Unlike the reference-entity islands, search never
  // preloads the ORM at all — it matches against a small build-time index.
  const { ready, index, load } = useSearchIndex({ defer: true })
  const searchFn = useMemo(
    () => (options: Parameters<typeof searchCompactIndex>[1]) => searchCompactIndex(index, options),
    [index]
  )
  // Dropdown-open is DERIVED: open while a search has run, unless the user
  // dismissed THIS results set (Escape/outside click). A new search run
  // produces a fresh results reference, which re-opens automatically —
  // mirroring the pre-hook behavior without a setState-in-effect.
  const [dismissedResults, setDismissedResults] = useState<unknown>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const doNavigate = useCallback(
    (url: string) => {
      if (navigate) {
        navigate(url)
      } else {
        window.location.assign(url)
      }
    },
    [navigate]
  )

  const {
    query,
    results,
    hasSearched,
    selectedIndex,
    handleInput,
    handleKeyDown,
    listboxId,
    optionId,
    inputProps,
    announcement,
  } = useSearchCombobox({
    ready,
    onSubmit: (result) => doNavigate(resultUrl(result)),
    searchFn,
  })

  const onInput = useCallback(
    (value: string) => {
      load()
      handleInput(value)
    },
    [load, handleInput]
  )

  const isOpen = hasSearched && dismissedResults !== results

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'Escape') {
        setDismissedResults(results)
        inputRef.current?.blur()
        return
      }
      // Enter with no highlighted row → the full results page (uncapped), rather
      // than jumping to the first dropdown hit. Arrow-selected Enter still opens
      // that specific result (handled by the shared hook below).
      if (e.key === 'Enter' && selectedIndex < 0) {
        e.preventDefault()
        const term = query.trim()
        if (term) doNavigate(`/search?q=${encodeURIComponent(term)}`)
        return
      }
      handleKeyDown(e)
    },
    [isOpen, results, handleKeyDown, selectedIndex, query, doNavigate]
  )

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        e.target instanceof Node &&
        !containerRef.current.contains(e.target)
      ) {
        setDismissedResults(results)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [results])

  // Cmd+K / Ctrl+K to focus search
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  const live = (
    <div className="sr-only" aria-live="polite">
      {announcement}
    </div>
  )

  // Search container — .srd-search treatment via the shared SearchField. The
  // inner input keeps focus:outline-none, so the container carries the
  // visible keyboard-focus indicator via focus-within (WCAG 2.4.7).
  const field = (
    <SearchField
      ref={inputRef}
      type="text"
      name="srd-search"
      placeholder={hero ? HERO_SEARCH_PLACEHOLDER : 'Search the SRD'}
      shortcut="⌘K"
      value={query}
      onChange={(e) => onInput(e.target.value)}
      onKeyDown={onKeyDown}
      onFocus={() => {
        load()
        setDismissedResults(null)
      }}
      className={hero ? undefined : 'w-56'}
      containerClassName={hero ? 'srd-hero-search__field' : undefined}
      glyphSize={hero ? 18 : undefined}
      {...inputProps}
      aria-label="Search the SRD"
      role="combobox"
      aria-expanded={isOpen}
      aria-controls={listboxId}
    />
  )

  const listbox = isOpen && (
    <div
      id={listboxId}
      role="listbox"
      className={`absolute top-full z-50 mt-1 max-h-96 overflow-y-auto rounded-panel border border-wk-faint bg-paper shadow-lg ${hero ? 'left-0 w-full' : 'right-0 w-80'}`}
    >
      {!ready ? (
        <div className="px-4 py-3 text-sm text-wk-muted">Loading search index…</div>
      ) : results.length > 0 ? (
        results.map((result, index) => (
          <a
            key={result.id}
            id={optionId(index)}
            role="option"
            aria-selected={index === selectedIndex}
            href={resultUrl(result)}
            className={`block px-4 py-3 text-sm transition-colors ${
              index === selectedIndex ? 'bg-wk-bg' : 'hover:bg-wk-bg'
            }`}
          >
            <div className="font-medium text-ink">{result.title}</div>
            <div className="mt-0.5 text-xs text-wk-muted">{result.group}</div>
          </a>
        ))
      ) : (
        <div className="px-4 py-3 text-sm text-wk-muted">No results found</div>
      )}
    </div>
  )

  if (hero) {
    // The form's own submit — Enter with the listbox closed, or the Search
    // button — opens the full results page, as Enter does in the bar.
    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      const term = query.trim()
      if (term) doNavigate(`/search?q=${encodeURIComponent(term)}`)
      else inputRef.current?.focus()
    }
    return (
      <IslandErrorBoundary>
        <HeroSearchForm onSubmit={onSubmit}>
          <div className="srd-hero-search__box relative" ref={containerRef}>
            {live}
            {field}
            {listbox}
          </div>
        </HeroSearchForm>
      </IslandErrorBoundary>
    )
  }

  return (
    <IslandErrorBoundary>
      <div className="relative" ref={containerRef}>
        {live}
        {field}
        {listbox}
      </div>
    </IslandErrorBoundary>
  )
}
