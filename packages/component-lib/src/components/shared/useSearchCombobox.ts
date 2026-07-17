/**
 * useSearchCombobox — the shared logic layer behind the SRD search
 * comboboxes (audit item 11).
 *
 * srd's SearchIsland (dropdown-under-input, URL navigation) and ITUN's
 * GlobalSearch (ModalShell dialog, detail-modal navigation) duplicated the
 * same ~150 lines: 150 ms debounce, category+entity result blending
 * (3 schema slots inside a 10-row budget), ArrowUp/Down/Enter selection, and
 * the combobox ARIA id wiring. This hook owns that logic; the apps own their
 * shells, row rendering, and what "open a result" means (onSubmit).
 *
 * Deliberately headless and router/persistence-agnostic: results are
 * normalized ({kind, id, title, group, schemaId, entity?}) and every
 * side-effectful decision is a callback. Escape/open-state handling stays
 * with the caller — the two shells close very differently.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { SURefEntity, SURefEnumSchemaName, SearchResult } from 'salvageunion-reference'
import { getEntitySchemas, search } from 'salvageunion-reference'

export type SearchComboboxResult =
  | {
      kind: 'schema'
      id: string
      title: string
      /** Right-hand label — always 'Category' for schema rows. */
      group: string
      schemaId: SURefEnumSchemaName
    }
  | {
      kind: 'entity'
      id: string
      title: string
      /** Right-hand label — the schema title, 'Salvage Union ' stripped. */
      group: string
      schemaId: SURefEnumSchemaName
      entity: SearchResult['entity'] & SURefEntity
    }

export type UseSearchComboboxOptions = {
  /**
   * Entity search only runs while true (deferred game-data loading). While
   * false, results are hidden entirely and the pending query re-runs
   * automatically when the flag flips true. Default true.
   */
  ready?: boolean
  /** Debounce for keystroke → search. Default 150 ms. */
  debounceMs?: number
  /** Total result rows (categories + entities). Default 10. */
  limit?: number
  /** Category rows reserved out of `limit`. Default 3. */
  schemaSlots?: number
  /** Invoked on Enter (highlighted row, else first row) — and by row clicks
   *  when the caller wires them through submit(). */
  onSubmit: (result: SearchComboboxResult) => void
  /**
   * Override the entity-search implementation. Defaults to the ORM-backed
   * `search()` from `salvageunion-reference`. Pass a different implementation
   * to decouple entity search from the full ORM/dataset — e.g. srd's
   * SearchIsland runs a build-time-generated compact index instead of
   * preloading the ~1.3 MB corpus just to power search.
   */
  searchFn?: (options: Parameters<typeof search>[0]) => SearchResult[]
}

function matchSchemas(query: string, slots: number): SearchComboboxResult[] {
  const q = query.toLowerCase().trim()
  if (!q) return []

  return getEntitySchemas()
    .filter(
      (s) =>
        s.displayName.toLowerCase().includes(q) ||
        s.displayNamePlural.toLowerCase().includes(q) ||
        s.id.includes(q)
    )
    .slice(0, slots)
    .map((s) => ({
      kind: 'schema' as const,
      id: `schema:${s.id}`,
      title: s.displayNamePlural,
      group: 'Category',
      schemaId: s.id as SURefEnumSchemaName,
    }))
}

function toEntityResult(result: SearchResult): SearchComboboxResult {
  return {
    kind: 'entity',
    id: result.entityId,
    title: result.entityName,
    group: result.schemaTitle.replace('Salvage Union ', ''),
    schemaId: result.schemaName,
    entity: result.entity as SearchResult['entity'] & SURefEntity,
  }
}

export function useSearchCombobox({
  ready = true,
  debounceMs = 150,
  limit = 10,
  schemaSlots = 3,
  onSubmit,
  searchFn = search,
}: UseSearchComboboxOptions) {
  const [query, setQuery] = useState('')
  const [rawResults, setRawResults] = useState<SearchComboboxResult[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const idPrefix = useId()
  const listboxId = `${idPrefix}-search-results`
  const optionId = useCallback((i: number) => `${idPrefix}-search-result-${i}`, [idPrefix])

  // Results stay hidden until data is ready — prevents phantom aria-live
  // announcements and Enter navigating to an unseen row.
  const results = useMemo(() => (ready ? rawResults : []), [ready, rawResults])

  const performSearch = useCallback(
    (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setRawResults([])
        setHasSearched(false)
        setSelectedIndex(-1)
        return
      }
      const schemaResults = matchSchemas(searchQuery, schemaSlots)
      const hits = ready
        ? searchFn({ query: searchQuery, limit: limit - schemaResults.length })
        : []
      setRawResults([...schemaResults, ...hits.map(toEntityResult)])
      setHasSearched(true)
      setSelectedIndex(-1)
    },
    [ready, limit, schemaSlots, searchFn]
  )

  const handleInput = useCallback(
    (value: string) => {
      setQuery(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => performSearch(value), debounceMs)
    },
    [performSearch, debounceMs]
  )

  // Re-run the pending query when data finishes loading, cancelling any
  // stale debounce timer that fired with the pre-ready closure.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally keyed to `ready` only — re-running on every query/performSearch change would bypass the debounce
  useEffect(() => {
    if (ready && query.trim()) {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: re-run the pending query once data becomes ready
      performSearch(query)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  // Debounce timer cleanup on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const submit = useCallback(
    (result: SearchComboboxResult) => {
      onSubmit(result)
    },
    [onSubmit]
  )

  /** Arrow/Enter handling — callers chain their own Escape behavior. */
  const handleKeyDown = useCallback(
    (e: { key: string; preventDefault: () => void }) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, -1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const target = selectedIndex >= 0 ? results[selectedIndex] : results[0]
        if (target) submit(target)
      }
    },
    [results, selectedIndex, submit]
  )

  /** Screen-reader result-count announcement (render in an aria-live region). */
  const announcement = !hasSearched
    ? null
    : !ready
      ? query.trim()
        ? 'Loading game data'
        : null
      : results.length > 0
        ? `${results.length} result${results.length === 1 ? '' : 's'} found`
        : 'No results found'

  /** Spread onto the <input>; add aria-expanded (open semantics differ per shell). */
  const inputProps = {
    role: 'combobox' as const,
    'aria-controls': listboxId,
    'aria-activedescendant':
      selectedIndex >= 0 && results[selectedIndex] ? optionId(selectedIndex) : undefined,
  }

  const clear = useCallback(() => {
    setQuery('')
    setRawResults([])
    setHasSearched(false)
    setSelectedIndex(-1)
  }, [])

  return {
    query,
    results,
    hasSearched,
    selectedIndex,
    handleInput,
    handleKeyDown,
    submit,
    listboxId,
    optionId,
    inputProps,
    announcement,
    clear,
  }
}
