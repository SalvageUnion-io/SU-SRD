import { useState, useRef, useCallback, useEffect } from 'react'
import { search } from 'salvageunion-reference'
import type { SearchResult } from 'salvageunion-reference'
import { getEntitySlug } from 'suref-react'

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
    url: `/schema/${result.schemaName}/item/${slug}`,
    title: result.entityName,
    schema: result.schemaTitle.replace('Salvage Union ', ''),
  }
}

export function SearchIsland() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DisplayResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const performSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      setIsOpen(false)
      return
    }

    const hits = search({ query: searchQuery, limit: 10 })
    const displayResults = hits.map(toDisplayResult)
    setResults(displayResults)
    setIsOpen(displayResults.length > 0)
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

  return (
    <div className="relative" ref={containerRef}>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search..."
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => results.length > 0 && setIsOpen(true)}
        className="w-40 rounded-md border border-su-grey-light bg-su-white px-3 py-1.5 text-sm text-su-input-text placeholder:text-su-grey focus:w-64 focus:outline-none focus:ring-2 focus:ring-su-orange transition-all md:w-48"
        aria-label="Search the SRD"
        aria-expanded={isOpen}
        role="combobox"
        aria-controls="search-results"
        aria-activedescendant={selectedIndex >= 0 ? `search-result-${selectedIndex}` : undefined}
      />

      {isOpen && results.length > 0 && (
        <div
          id="search-results"
          role="listbox"
          className="absolute right-0 top-full z-50 mt-1 w-80 max-h-96 overflow-y-auto rounded-md border border-su-grey-light bg-su-white shadow-lg"
        >
          {results.map((result, index) => (
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
          ))}
        </div>
      )}
    </div>
  )
}
