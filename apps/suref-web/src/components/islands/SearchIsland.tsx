import { useState, useRef, useCallback, useEffect, useId, useMemo } from 'react'
import { search, getEntitySchemas } from 'salvageunion-reference'
import type { SearchResult } from 'salvageunion-reference'
import { getEntitySlug } from 'salvageunion-reference'
import { useGameData } from '../../lib/useGameData'

type DisplayResult = {
  id: string
  url: string
  title: string
  schema: string
}

type SearchIslandProps = {
  /** Injectable navigation function — defaults to window.location.assign.
   *  Override in tests to spy on navigation without happy-dom limitations. */
  navigate?: (url: string) => void
}

function toDisplayResult(result: SearchResult): DisplayResult {
  const slug = getEntitySlug(result.entity)
  return {
    id: result.entityId,
    url: `/schema/${result.schemaName}/item/${slug}/`,
    title: result.entityName,
    schema: result.schemaTitle.replace('Salvage Union ', ''),
  }
}

function matchSchemas(query: string): DisplayResult[] {
  const q = query.toLowerCase().trim()
  if (!q) return []

  return getEntitySchemas()
    .filter(
      (s) =>
        s.displayName.toLowerCase().includes(q) ||
        s.displayNamePlural.toLowerCase().includes(q) ||
        s.id.includes(q)
    )
    .map((s) => ({
      id: `schema:${s.id}`,
      url: `/schema/${s.id}/`,
      title: s.displayNamePlural,
      schema: 'Category',
    }))
}

export function SearchIsland({ navigate }: SearchIslandProps = {}) {
  const { ready } = useGameData()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DisplayResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idPrefix = useId()
  const listboxId = `${idPrefix}-search-results`
  const optionId = (i: number) => `${idPrefix}-search-result-${i}`

  // Only expose results to the UI once data is loaded — prevents phantom
  // aria-live announcements, invisible keyboard-selectable options, and
  // Enter navigating to an unseen result while the loading row is shown.
  const visibleResults = useMemo(() => (ready ? results : []), [ready, results])

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

  const performSearch = useCallback(
    (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([])
        setIsOpen(false)
        setHasSearched(false)
        return
      }

      const schemaResults = matchSchemas(searchQuery).slice(0, 3)
      const hits = ready ? search({ query: searchQuery, limit: 10 - schemaResults.length }) : []
      const displayResults = [...schemaResults, ...hits.map(toDisplayResult)]
      setResults(displayResults)
      setIsOpen(true)
      setHasSearched(true)
      setSelectedIndex(-1)
    },
    [ready]
  )

  const handleInput = useCallback(
    (value: string) => {
      setQuery(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => performSearch(value), 150)
    },
    [performSearch]
  )

  // Re-run the pending query when data finishes loading.
  // Also cancels any stale debounce timer that fired with the pre-ready
  // closure (which returns [] for entity hits) so results are immediately
  // refreshed with real data rather than waiting for the next keystroke.
  useEffect(() => {
    if (ready && query.trim()) {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      performSearch(query)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  // Debounce timer cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, visibleResults.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, -1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const target = selectedIndex >= 0 ? visibleResults[selectedIndex] : visibleResults[0]
        if (target) {
          doNavigate(target.url)
        }
      } else if (e.key === 'Escape') {
        setIsOpen(false)
        inputRef.current?.blur()
      }
    },
    [isOpen, visibleResults, selectedIndex, doNavigate]
  )

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

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

  return (
    <div className="relative" ref={containerRef}>
      <div className="sr-only" aria-live="polite">
        {hasSearched && ready
          ? visibleResults.length > 0
            ? `${visibleResults.length} result${visibleResults.length === 1 ? '' : 's'} found`
            : 'No results found'
          : hasSearched && query.trim()
            ? 'Loading game data'
            : null}
      </div>
      {/* Search container — .srd-search treatment: bordered su-black, tight radius, font-mono.
          The inner input keeps focus:outline-none, so the container carries the
          visible keyboard-focus indicator via focus-within (WCAG 2.4.7). */}
      <div className="flex items-center gap-2 rounded border border-su-black bg-su-white px-3 py-[7px] font-mono text-[13px] text-su-grey-dark focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-su-orange">
        {/* Search glyph */}
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          width={14}
          height={14}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 opacity-60"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search…"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => hasSearched && setIsOpen(true)}
          className="w-52 bg-transparent font-mono text-[13px] text-su-black placeholder:text-su-grey-dark focus:outline-none"
          aria-label="Search the SRD"
          aria-expanded={isOpen}
          role="combobox"
          aria-controls={listboxId}
          aria-activedescendant={
            selectedIndex >= 0 && visibleResults[selectedIndex]
              ? optionId(selectedIndex)
              : undefined
          }
        />
      </div>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute right-0 top-full z-50 mt-1 max-h-96 w-80 overflow-y-auto rounded-md border border-su-grey-light bg-su-white shadow-lg"
        >
          {!ready ? (
            <div className="px-4 py-3 text-sm text-su-grey-dark">Loading game data…</div>
          ) : visibleResults.length > 0 ? (
            visibleResults.map((result, index) => (
              <a
                key={result.id}
                id={optionId(index)}
                role="option"
                aria-selected={index === selectedIndex}
                href={result.url}
                className={`block px-4 py-3 text-sm transition-colors ${
                  index === selectedIndex ? 'bg-su-blue-pale' : 'hover:bg-su-blue-pale'
                }`}
              >
                <div className="font-medium text-su-black">{result.title}</div>
                <div className="mt-0.5 text-xs text-su-grey-dark">{result.schema}</div>
              </a>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-su-grey-dark">No results found</div>
          )}
        </div>
      )}
    </div>
  )
}
