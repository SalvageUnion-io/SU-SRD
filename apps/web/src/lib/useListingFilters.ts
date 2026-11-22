import { useCallback, useEffect, useState } from 'react'
import type { TechLevel } from './listingGroups'
import {
  PARAM_COLUMNS,
  PARAM_NAME,
  PARAM_SORT,
  PARAM_SOURCE,
  PARAM_TECH_LEVEL,
  PARAM_TRAIT,
  PARAM_TREE,
  PARAM_VIEW,
} from './listingParams'

/** A listing's sort: the column's key, and which way. */
export type ListingSort = { key: string; descending: boolean }

/**
 * Read a single query-param value from the current URL. SSR-safe: the SSG
 * renders the listing's `ssr` markup under Bun (no `window`), so guard every
 * location read.
 */
function readUrlParam(name: string): string {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get(name) ?? ''
}

/** Read a comma-separated query param into its tokens. */
function readUrlList(name: string): string[] {
  const raw = readUrlParam(name)
  return raw ? raw.split(',').filter(Boolean) : []
}

/** A single-choice param; an older shared link's comma list keeps its first entry. */
function readUrlChoice(name: string): string {
  return readUrlParam(name).split(',')[0] ?? ''
}

/** `sp` sorts up by that column, `-sp` down; anything else is the book's order. */
export function parseSort(raw: string): ListingSort | undefined {
  const descending = raw.startsWith('-')
  const key = descending ? raw.slice(1) : raw
  return key ? { key, descending } : undefined
}

/** The sort as its query value (`parseSort`'s inverse); the book's order is no value. */
export function formatSort(sort: ListingSort | undefined): string {
  return sort ? `${sort.descending ? '-' : ''}${sort.key}` : ''
}

/**
 * A listing's filters, sort and phone columns: state that opens on the URL's
 * query, so a shared or bookmarked link restores the exact view, and writes
 * itself back there (`replaceState`: no history entry a keystroke).
 */
export function useListingFilters({
  techLevels,
  view,
  viewInUrl,
}: {
  /** Every Tech Level the listing offers: all of them picked is none picked. */
  techLevels: readonly TechLevel[]
  /** The listing's view, which rides the same query once the reader chose it. */
  view: string
  viewInUrl: boolean
}) {
  // Lazy initializers run once; the reads are window-guarded for SSR.
  const [techLevelFilters, setTechLevelFilters] = useState<Set<string>>(
    () => new Set(readUrlList(PARAM_TECH_LEVEL))
  )
  const [source, setSource] = useState(() => readUrlChoice(PARAM_SOURCE))
  const [tree, setTree] = useState(() => readUrlChoice(PARAM_TREE))
  const [trait, setTrait] = useState(() => readUrlChoice(PARAM_TRAIT))
  const [name, setName] = useState(() => readUrlParam(PARAM_NAME))
  const [sort, setSort] = useState(() => parseSort(readUrlParam(PARAM_SORT)))
  const [columns, setColumns] = useState<readonly string[]>(() => readUrlList(PARAM_COLUMNS))

  // Idempotent: only writes when the resulting query string actually differs
  // from the current one, so the mount-time run never clobbers an incoming
  // shared link.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const setOrDelete = (key: string, value: string) => {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    setOrDelete(PARAM_TECH_LEVEL, [...techLevelFilters].join(','))
    setOrDelete(PARAM_SOURCE, source)
    setOrDelete(PARAM_TREE, tree)
    setOrDelete(PARAM_TRAIT, trait)
    setOrDelete(PARAM_NAME, name)
    setOrDelete(PARAM_SORT, formatSort(sort))
    setOrDelete(PARAM_COLUMNS, columns.join(','))
    setOrDelete(PARAM_VIEW, viewInUrl ? view : '')
    const qs = params.toString()
    const nextUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    const currentUrl = `${window.location.pathname}${window.location.search}`
    if (nextUrl !== currentUrl) {
      window.history.replaceState(window.history.state, '', nextUrl)
    }
  }, [techLevelFilters, source, tree, trait, name, sort, columns, view, viewInUrl])

  const toggleTechLevel = useCallback(
    (level: TechLevel) => {
      setTechLevelFilters((prev) => {
        const next = new Set(prev)
        const key = String(level)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        if (techLevels.every((tl) => next.has(String(tl)))) return new Set()
        return next
      })
    },
    [techLevels]
  )
  const clearTechLevels = useCallback(() => setTechLevelFilters(new Set()), [])
  /**
   * A column's label pressed: by it, the other way on a second press. A
   * measure's first press is highest first (`highFirst`), a word's A to Z.
   */
  const sortBy = useCallback(
    (key: string, highFirst = false) =>
      setSort((now) => ({ key, descending: now?.key === key ? !now.descending : highFirst })),
    []
  )
  const clearSort = useCallback(() => setSort(undefined), [])
  const clear = useCallback(() => {
    setTechLevelFilters(new Set())
    setSource('')
    setTree('')
    setTrait('')
    setName('')
  }, [])

  return {
    techLevelFilters,
    source,
    tree,
    trait,
    name,
    sort,
    columns,
    setSource,
    setTree,
    setTrait,
    setName,
    setColumns,
    toggleTechLevel,
    clearTechLevels,
    sortBy,
    clearSort,
    clear,
  }
}
