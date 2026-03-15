import { useState, useRef, useCallback, useEffect } from 'react'
import { search, getEntitySchemas } from 'salvageunion-reference'
import type { SearchResult } from 'salvageunion-reference'
import { getEntitySlug } from 'salvageunion-reference'

type DisplayResult = {
  id: string
  url: string
  title: string
  schema: string
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

export function SearchIsland() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DisplayResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const performSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      setIsOpen(false)
      setHasSearched(false)
      return
    }

    const schemaResults = matchSchemas(searchQuery)
    const hits = search({ query: searchQuery, limit: 10 - schemaResults.length })
    const displayResults = [...schemaResults, ...hits.map(toDisplayResult)]
    setResults(displayResults)
    setIsOpen(true)
    setHasSearched(true)
    setSelectedIndex(-1)
  }, [])

  const handleInput = useCallback(
    (value: string) => {
      setQuery(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => performSearch(value), 150)
    },
    [performSearch]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, -1))
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault()
        const el = document.getElementById(`search-result-${selectedIndex}`)
        if (el instanceof HTMLAnchorElement) {
          el.click()
        }
      } else if (e.key === 'Escape') {
        setIsOpen(false)
        inputRef.current?.blur()
      }
    },
    [isOpen, results, selectedIndex]
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
        {hasSearched &&
          (results.length > 0
            ? `${results.length} result${results.length === 1 ? '' : 's'} found`
            : 'No results found')}
      </div>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search..."
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => hasSearched && setIsOpen(true)}
        className="w-40 rounded-md border border-su-grey-light bg-su-white px-3 py-1.5 text-sm text-su-input-text placeholder:text-su-grey focus:w-64 focus:outline-none focus:ring-2 focus:ring-su-orange transition-all md:w-48"
        aria-label="Search the SRD"
        aria-expanded={isOpen}
        role="combobox"
        aria-controls="search-results"
        aria-activedescendant={selectedIndex >= 0 ? `search-result-${selectedIndex}` : undefined}
      />

      {isOpen && (
        <div
          id="search-results"
          role="listbox"
          className="absolute right-0 top-full z-50 mt-1 w-80 max-h-96 overflow-y-auto rounded-md border border-su-grey-light bg-su-white shadow-lg"
        >
          {results.length > 0 ? (
            results.map((result, index) => (
              <a
                key={result.id}
                id={`search-result-${index}`}
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
