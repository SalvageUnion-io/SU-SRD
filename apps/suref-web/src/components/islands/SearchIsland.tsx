import { useCallback, useEffect, useRef, useState } from 'react'
import { getEntitySlug } from 'salvageunion-reference'
import { useSearchCombobox } from 'suref-react'
import type { SearchComboboxResult } from 'suref-react'
import { useGameData } from '../../lib/useGameData'
import { IslandErrorBoundary } from './IslandErrorBoundary'

type SearchIslandProps = {
  /** Injectable navigation function — defaults to window.location.assign.
   *  Override in tests to spy on navigation without happy-dom limitations. */
  navigate?: (url: string) => void
}

/** Site URL for a combobox result: category listing or entity item page. */
function resultUrl(result: SearchComboboxResult): string {
  if (result.kind === 'schema') return `/schema/${result.schemaId}/`
  return `/schema/${result.schemaId}/item/${getEntitySlug(result.entity)}/`
}

export function SearchIsland({ navigate }: SearchIslandProps = {}) {
  // Deferred: the game-data chunks don't download until first user intent
  // (focusing the input or typing) — keeps them off every page's critical path.
  const { ready, load } = useGameData({ defer: true })
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
      handleKeyDown(e)
    },
    [isOpen, results, handleKeyDown]
  )

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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

  return (
    <IslandErrorBoundary>
      <div className="relative" ref={containerRef}>
        <div className="sr-only" aria-live="polite">
          {announcement}
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
            name="srd-search"
            placeholder="Search…"
            value={query}
            onChange={(e) => onInput(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => {
              load()
              setDismissedResults(null)
            }}
            className="w-52 bg-transparent font-mono text-[13px] text-su-black placeholder:text-su-grey-dark focus:outline-none"
            {...inputProps}
            aria-label="Search the SRD"
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={listboxId}
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
            ) : results.length > 0 ? (
              results.map((result, index) => (
                <a
                  key={result.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === selectedIndex}
                  href={resultUrl(result)}
                  className={`block px-4 py-3 text-sm transition-colors ${
                    index === selectedIndex ? 'bg-su-blue-pale' : 'hover:bg-su-blue-pale'
                  }`}
                >
                  <div className="font-medium text-su-black">{result.title}</div>
                  <div className="mt-0.5 text-xs text-su-grey-dark">{result.group}</div>
                </a>
              ))
            ) : (
              <div className="px-4 py-3 text-sm text-su-grey-dark">No results found</div>
            )}
          </div>
        )}
      </div>
    </IslandErrorBoundary>
  )
}
