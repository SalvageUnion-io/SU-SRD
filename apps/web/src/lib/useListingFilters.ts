import { useCallback, useEffect, useState } from 'react'
import type { TechLevel } from './listingGroups'
import {
  listingColumnsStorageKey,
  PARAM_ACTION,
  PARAM_COLUMNS,
  PARAM_NAME,
  PARAM_RANGE,
  PARAM_SORT,
  PARAM_SOURCE,
  PARAM_TECH_LEVEL,
  PARAM_TRAIT,
  PARAM_TREE,
  PARAM_VIEW,
  PARAM_WEAPONS,
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

/** The phone columns last chosen on this listing, or none. Storage can be absent or throw. */
function readStoredColumns(schemaId: string | undefined): string[] {
  if (!schemaId || typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(listingColumnsStorageKey(schemaId)) ?? ''
    return raw.split(',').filter(Boolean)
  } catch {
    return []
  }
}

function storeColumns(schemaId: string | undefined, columns: readonly string[]) {
  if (!schemaId) return
  try {
    window.localStorage.setItem(listingColumnsStorageKey(schemaId), columns.join(','))
  } catch {
    // Not remembered past this page; the choice still holds here.
  }
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
  schemaId,
  techLevels,
  view,
  viewInUrl,
}: {
  /** The listing: the phone columns last chosen on it are remembered in this browser. */
  schemaId?: string
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
  const [range, setRange] = useState(() => readUrlChoice(PARAM_RANGE))
  const [action, setAction] = useState(() => readUrlChoice(PARAM_ACTION))
  const [weapons, setWeapons] = useState(() => readUrlParam(PARAM_WEAPONS) === '1')
  const [name, setName] = useState(() => readUrlParam(PARAM_NAME))
  const [sort, setSort] = useState(() => parseSort(readUrlParam(PARAM_SORT)))
  // A link's columns, else the ones last chosen here (r7 E5); they ride the
  // URL only once chosen on this page, or arrived on a link that named them.
  const [columns, setChosenColumns] = useState<readonly string[]>(() => {
    const fromUrl = readUrlList(PARAM_COLUMNS)
    return fromUrl.length > 0 ? fromUrl : readStoredColumns(schemaId)
  })
  const [columnsInUrl, setColumnsInUrl] = useState(() => readUrlList(PARAM_COLUMNS).length > 0)
  const setColumns = useCallback(
    (next: readonly string[]) => {
      setChosenColumns(next)
      setColumnsInUrl(true)
      storeColumns(schemaId, next)
    },
    [schemaId]
  )

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
    setOrDelete(PARAM_RANGE, range)
    setOrDelete(PARAM_ACTION, action)
    setOrDelete(PARAM_WEAPONS, weapons ? '1' : '')
    setOrDelete(PARAM_NAME, name)
    setOrDelete(PARAM_SORT, formatSort(sort))
    setOrDelete(PARAM_COLUMNS, columnsInUrl ? columns.join(',') : '')
    setOrDelete(PARAM_VIEW, viewInUrl ? view : '')
    const qs = params.toString()
    const nextUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    const currentUrl = `${window.location.pathname}${window.location.search}`
    if (nextUrl !== currentUrl) {
      window.history.replaceState(window.history.state, '', nextUrl)
    }
  }, [
    techLevelFilters,
    source,
    tree,
    trait,
    range,
    action,
    weapons,
    name,
    sort,
    columns,
    columnsInUrl,
    view,
    viewInUrl,
  ])

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
    setRange('')
    setAction('')
    setWeapons(false)
    setName('')
  }, [])

  return {
    techLevelFilters,
    source,
    tree,
    trait,
    range,
    action,
    weapons,
    name,
    sort,
    columns,
    setSource,
    setTree,
    setTrait,
    setRange,
    setAction,
    setWeapons,
    setName,
    setColumns,
    toggleTechLevel,
    clearTechLevels,
    sortBy,
    clearSort,
    clear,
  }
}
