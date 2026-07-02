/**
 * GlobalSearch — app-wide reference search (design-review P-2).
 *
 * Port of suref-web's SearchIsland (apps/suref-web/src/components/islands/
 * SearchIsland.tsx), reshaped for ITUN:
 * - The dropdown-under-input becomes a ModalShell dialog (the Phase-1 dialog
 *   standard) opened by Cmd/Ctrl+K or the AppHeader trigger.
 * - Selecting an entity opens ITUN's canonical detail affordance —
 *   suref-react's useDetailModal — instead of navigating to an SRD page.
 *   Entities the modal can't render fall back to the View-in-SRD deep link.
 * - Category rows (schema matches) have no in-app destination, so they open
 *   the SRD site's schema index in a new tab.
 * - The island defers game-data loading until first user intent; ITUN's whole
 *   tree already renders behind GameDataReady (root layout), so search() is
 *   always safe here and the deferred-load machinery is dropped.
 *
 * Mounted once from the root layout so the shortcut works on every surface —
 * including live sheets and snapshots, where AppHeader (the visible trigger)
 * is suppressed.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { SearchResult, SURefEntity } from 'salvageunion-reference'
import { getEntitySchemas, getEntitySlug, search } from 'salvageunion-reference'
import { ModalShell, useDetailModal } from 'suref-react'

import { deepLinkTo, deepLinkToSchema } from '../../lib/suref-web-deep-link'

type DisplayResult =
  | {
      kind: 'schema'
      id: string
      title: string
      group: string
      url: string
    }
  | {
      kind: 'entity'
      id: string
      title: string
      group: string
      entity: SearchResult['entity']
    }

function toEntityResult(result: SearchResult): DisplayResult {
  return {
    kind: 'entity',
    id: result.entityId,
    title: result.entityName,
    group: result.schemaTitle.replace('Salvage Union ', ''),
    entity: result.entity,
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
      kind: 'schema',
      id: `schema:${s.id}`,
      title: s.displayNamePlural,
      group: 'Category',
      url: deepLinkToSchema(s.id),
    }))
}

type GlobalSearchProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DisplayResult[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [detailEntity, setDetailEntity] = useState<SURefEntity | undefined>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idPrefix = useId()
  const listboxId = `${idPrefix}-search-results`
  const optionId = (i: number) => `${idPrefix}-search-result-${i}`

  // ITUN's canonical entity detail affordance. Rendered as a sibling of the
  // search dialog so it survives the search dialog closing.
  const { control: detailControl, modal: detailModal } = useDetailModal(detailEntity)

  const performSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      setHasSearched(false)
      setSelectedIndex(-1)
      return
    }

    const schemaResults = matchSchemas(searchQuery).slice(0, 3)
    const hits = search({ query: searchQuery, limit: 10 - schemaResults.length })
    setResults([...schemaResults, ...hits.map(toEntityResult)])
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

  // Debounce timer cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // Cmd+K / Ctrl+K toggles the search dialog from any surface (Escape and
  // backdrop dismissal are handled by the dialog itself).
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [open, onOpenChange])

  const pick = useCallback(
    (result: DisplayResult) => {
      if (result.kind === 'schema') {
        // No in-app schema listing — open the SRD category page in a new tab.
        window.open(result.url, '_blank', 'noopener,noreferrer')
        return
      }
      const schemaName = result.entity.schemaName
      if (typeof schemaName !== 'string') {
        // Defensive fallback: no detail rendering — deep-link to the SRD page.
        window.open(
          deepLinkTo({ schemaName: String(schemaName), slug: getEntitySlug(result.entity) }),
          '_blank',
          'noopener,noreferrer'
        )
        return
      }
      onOpenChange(false)
      setDetailEntity(result.entity)
      detailControl.onClick()
    },
    [onOpenChange, detailControl]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, -1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const target = selectedIndex >= 0 ? results[selectedIndex] : results[0]
        if (target) pick(target)
      }
    },
    [results, selectedIndex, pick]
  )

  return (
    <>
      <ModalShell
        open={open}
        onOpenChange={onOpenChange}
        title="Search the SRD"
        description="Search Salvage Union reference entities and categories"
        headerBg="bg-su-orange"
        maxWidth="max-w-xl"
        align="top"
        initialFocus={inputRef}
      >
        <div className="flex flex-col gap-3 bg-paper p-4">
          <div className="sr-only" aria-live="polite">
            {hasSearched
              ? results.length > 0
                ? `${results.length} result${results.length === 1 ? '' : 's'} found`
                : 'No results found'
              : null}
          </div>

          <input
            ref={inputRef}
            type="text"
            name="reference-search"
            placeholder="Search chassis, equipment, abilities…"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Search the SRD"
            role="combobox"
            aria-expanded={hasSearched && results.length > 0}
            aria-controls={listboxId}
            aria-activedescendant={
              selectedIndex >= 0 && results[selectedIndex] ? optionId(selectedIndex) : undefined
            }
            className="w-full rounded-[3px] border-chrome border-ink bg-paper px-3 py-2 font-body text-sm text-ink placeholder:text-wk-muted focus:outline-2 focus:outline-offset-2 focus:outline-rust"
          />

          {hasSearched &&
            (results.length > 0 ? (
              <div
                id={listboxId}
                role="listbox"
                aria-label="Search results"
                className="flex max-h-80 flex-col gap-1 overflow-y-auto"
              >
                {results.map((result, index) => (
                  <button
                    key={result.id}
                    id={optionId(index)}
                    type="button"
                    role="option"
                    aria-selected={index === selectedIndex}
                    onClick={() => pick(result)}
                    className={`flex w-full cursor-pointer items-baseline justify-between gap-3 rounded-[3px] border-chrome px-3 py-2 text-left transition-colors ${
                      index === selectedIndex
                        ? 'border-rust bg-wk-bg-2'
                        : 'border-transparent hover:bg-wk-bg-2'
                    }`}
                  >
                    <span className="min-w-0 truncate font-body text-sm font-medium text-ink">
                      {result.title}
                    </span>
                    <span className="shrink-0 font-cond text-xs font-semibold uppercase tracking-caps-snug text-wk-muted">
                      {result.group}
                      {result.kind === 'schema' && <span aria-hidden="true"> &#8599;</span>}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="font-body text-sm text-wk-muted">No results found</p>
            ))}

          <p className="font-body text-xs text-wk-muted">
            &#8593;&#8595; to navigate &middot; Enter to open &middot; Esc to close &middot;
            category rows open the SRD site in a new tab
          </p>
        </div>
      </ModalShell>

      {detailModal}
    </>
  )
}
