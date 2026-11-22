/**
 * useSearchCombobox — the shared logic layer behind the search comboboxes:
 * the site's one search (`SearchIsland`, in the Union bar of both the
 * reference pages and the app) and Play's SRD Explorer.
 *
 * It owns the 150 ms debounce, category+entity result blending (3 schema
 * slots inside a 10-row budget), ArrowUp/Down/Enter selection and the
 * combobox ARIA id wiring; the callers own their shells, row rendering, and
 * what "open a result" means (onSubmit).
 *
 * Deliberately headless and router/persistence-agnostic: results are
 * normalized ({kind, id, title, group, schemaId, entity?}) and every
 * side-effectful decision is a callback. Escape/open-state handling stays
 * with the caller.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { RefEntity, RefEnumSchemaName, SearchResult } from 'salvageunion-reference'
import { getEntitySchemas, search, searchOneSlipAway } from 'salvageunion-reference'
import { schemaPluralLabel } from '../../lib/schemaLabels'
import { compositionsCopy } from '../../messages/components-compositions'
import { SEARCHING } from '../containers/loadingCopy'
import { NO_RESULTS } from './searchCopy'

export type SearchComboboxResult =
  | {
      kind: 'schema'
      id: string
      title: string
      /** Right-hand label — always 'Category' for schema rows. */
      group: string
      schemaId: RefEnumSchemaName
    }
  | {
      kind: 'entity'
      id: string
      title: string
      /**
       * Right-hand label — the schema's authored plural ('Crawler Bays'), the
       * same string the category rows above it use, so one dropdown never
       * spells a schema two ways.
       */
      group: string
      schemaId: RefEnumSchemaName
      entity: SearchResult['entity'] & RefEntity
      /**
       * A result with a page that is not its schema's item page, and a kind
       * that is not its schema's name: a pattern, under its host.
       */
      page?: { href: string; kind: string }
    }
  | {
      /**
       * The row after the last result when more matched than the list holds
       * (`moreRow`): "Show more", which lengthens the list in place. The hook
       * answers it itself (`submit`); a host never opens it.
       */
      kind: 'more'
      id: string
      /** 'Show more'. */
      title: string
      /** '12 more results'. */
      group: string
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
  /**
   * End a list that leaves matches out with "Show more" (`kind: 'more'`),
   * after `limit`'s rows; each press shows `limit` more. Default false: a
   * host must draw that row as an act, never a link.
   */
  moreRow?: boolean
  /** Invoked on Enter (highlighted row, else first row) — and by row clicks
   *  when the caller wires them through submit(). */
  onSubmit: (result: SearchComboboxResult) => void
  /**
   * Override the entity-search implementation. Defaults to the ORM-backed
   * `search()` from `salvageunion-reference`. Pass a different implementation
   * to decouple entity search from the full ORM/dataset — e.g. the reference site's
   * SearchIsland runs a build-time-generated compact index instead of
   * preloading the ~1.3 MB corpus just to power search.
   */
  searchFn?: (options: Parameters<typeof search>[0]) => SearchHit[]
}

/** A hit, with what a pattern's row says of itself (the compact index's `pattern`). */
type SearchHit = SearchResult & { pattern?: { href: string; kind: string } }

/** A query with nothing but its letters and digits, as a kind's name is compared. */
function squashed(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/** The shortest query a slip is forgiven in, as an entity's name is. */
const SLIP_MIN_LENGTH = 4

function matchSchemas(query: string, slots: number): SearchComboboxResult[] {
  const q = query.toLowerCase().trim()
  if (!q) return []
  // A kind is found without its punctuation too: "biotitan" finds Bio-Titans.
  const bare = squashed(q)

  const literal = getEntitySchemas().filter(
    (s) =>
      s.displayName.toLowerCase().includes(q) ||
      s.displayNamePlural.toLowerCase().includes(q) ||
      s.id.includes(q) ||
      (bare.length > 2 && squashed(s.displayNamePlural).includes(bare))
  )
  // With no kind named as typed, one a slip away ("chasis" finds Chassis):
  // the forgiveness an entity's name gets (`searchOneSlipAway`).
  const found =
    literal.length > 0 || q.length < SLIP_MIN_LENGTH
      ? literal
      : getEntitySchemas().filter((s) =>
          [s.displayName, s.displayNamePlural].some((name) =>
            searchOneSlipAway(q, name.toLowerCase())
          )
        )

  return found.slice(0, slots).map((s) => ({
    kind: 'schema' as const,
    id: `schema:${s.id}`,
    title: s.displayNamePlural,
    group: 'Category',
    schemaId: s.id as RefEnumSchemaName,
  }))
}

/** Every match is counted up to here; a search this wide is not a list anyone reads. */
const COUNT_LIMIT = 200

/** "Show more", for the matches a full list left out. */
function moreResult(hidden: number): SearchComboboxResult {
  return {
    kind: 'more',
    id: 'more',
    title: compositionsCopy('showMore'),
    // At the count's limit there may be more than were counted.
    group: compositionsCopy('moreResults', {
      count: `${hidden}${hidden >= COUNT_LIMIT - 1 ? '+' : ''}`,
    }),
  }
}

function toEntityResult(result: SearchHit): SearchComboboxResult {
  const { pattern } = result
  return {
    kind: 'entity',
    id: result.entityId,
    title: result.entityName,
    group: pattern ? pattern.kind : schemaPluralLabel(result.schemaName),
    schemaId: result.schemaName,
    entity: result.entity,
    ...(pattern ? { page: pattern } : {}),
  }
}

export function useSearchCombobox({
  ready = true,
  debounceMs = 150,
  limit = 10,
  schemaSlots = 3,
  moreRow = false,
  onSubmit,
  searchFn = search,
}: UseSearchComboboxOptions) {
  const [query, setQuery] = useState('')
  const [rawResults, setRawResults] = useState<SearchComboboxResult[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** The rows "Show more" has added to `limit`, for the query in the field. */
  const extraRef = useRef(0)

  const idPrefix = useId()
  const listboxId = `${idPrefix}-search-results`
  const optionId = useCallback((i: number) => `${idPrefix}-search-result-${i}`, [idPrefix])

  // Results stay hidden until data is ready — prevents phantom aria-live
  // announcements and Enter navigating to an unseen row.
  const results = useMemo(() => (ready ? rawResults : []), [ready, rawResults])

  const performSearch = useCallback(
    (searchQuery: string, extra = 0) => {
      extraRef.current = extra
      if (!searchQuery.trim()) {
        setRawResults([])
        setHasSearched(false)
        setSelectedIndex(-1)
        return
      }
      const schemaResults = matchSchemas(searchQuery, schemaSlots)
      const room = limit + extra - schemaResults.length
      if (!moreRow) {
        const hits = ready ? searchFn({ query: searchQuery, limit: room }) : []
        setRawResults([...schemaResults, ...hits.map(toEntityResult)])
      } else {
        const all = ready ? searchFn({ query: searchQuery, limit: COUNT_LIMIT }) : []
        const hits = all.slice(0, room)
        // A full list is followed by the row that lengthens it.
        const more = all.length > room ? [moreResult(all.length - room)] : []
        setRawResults([...schemaResults, ...hits.map(toEntityResult), ...more])
      }
      setHasSearched(true)
      // Lengthened, the highlight stands on the first row added.
      setSelectedIndex(extra > 0 ? extra : -1)
    },
    [ready, limit, schemaSlots, moreRow, searchFn]
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
      // "Show more" is the list's own act: the same query, `limit` rows longer.
      if (result.kind === 'more') performSearch(query, extraRef.current + limit)
      else onSubmit(result)
    },
    [onSubmit, performSearch, query, limit]
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
        ? SEARCHING
        : null
      : results.length > 0
        ? `${results.length} result${results.length === 1 ? '' : 's'} found`
        : NO_RESULTS

  /** Spread onto the <input>; add aria-expanded (open semantics differ per shell). */
  const inputProps = {
    role: 'combobox' as const,
    'aria-controls': listboxId,
    'aria-activedescendant':
      selectedIndex >= 0 && results[selectedIndex] ? optionId(selectedIndex) : undefined,
  }

  const clear = useCallback(() => {
    extraRef.current = 0
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
