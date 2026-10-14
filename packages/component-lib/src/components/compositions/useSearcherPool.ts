/**
 * `EntitySearcher`'s pool: the collection it searches, the text query and the
 * facet chips over it, and what survives them. Persistence-agnostic like the
 * searcher: `selected` is the caller's, read here only for the Status facet
 * and the on-sheet count.
 */

import { useMemo, useState } from 'react'
import type { EntitySchemaName, SURefEnumSchemaName } from 'salvageunion-reference'
import { SalvageUnionReference, searchIn, techLevelRank } from 'salvageunion-reference'
import type { TechLevel } from 'salvageunion-reference/rules'
import type {
  EntityLike,
  FacetConfig,
  FacetRowConfig,
  PoolEntity,
  TechLevelLike,
} from './entitySearcherTypes'

const ALL_TLS: TechLevel[] = [1, 2, 3, 4, 5, 6, 'B', 'N']

function tlLabel(tl: TechLevelLike): string {
  return typeof tl === 'number' ? `TL${tl}` : tl === 'B' ? 'Bio' : 'Nanite'
}

function tlSwatch(tl: TechLevelLike): string {
  return `var(--color-tl-${typeof tl === 'number' ? tl : tl.toLowerCase()})`
}

function toggleIn<T>(set: Set<T>, value: T, setter: (s: Set<T>) => void) {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  setter(next)
}

type SearcherPoolOptions = {
  schema: EntitySchemaName
  selected: string[]
  idOf: (item: EntityLike) => string
  filter?: (item: EntityLike) => boolean
  facets?: FacetConfig
  /** A browser chooses nothing, so it has no Status facet. */
  browse: boolean
  /** The chosen-list noun, for the Status facet's "… only" chip. */
  chosenLabel: string
}

type SearcherPool = {
  query: string
  setQuery: (query: string) => void
  /** The whole collection, narrowed by `filter`, sorted by TL then name. */
  pool: PoolEntity[]
  /** The pool after the query and every active facet. */
  visible: PoolEntity[]
  /** Copies of pool entities in `selected`. */
  totalOnSheet: number
  /** Copies of `item` in `selected`. */
  countOf: (item: EntityLike) => number
  /** The facet rows, minus the "Show" row. */
  facetRows: FacetRowConfig[]
  /** The Status facet's "Show" row, or null when it is off. */
  showRow: FacetRowConfig | null
  /** How many facet chips are narrowing the pool. */
  activeFilters: number
}

export function useSearcherPool({
  schema,
  selected,
  idOf,
  filter,
  facets,
  browse,
  chosenLabel,
}: SearcherPoolOptions): SearcherPool {
  const [query, setQuery] = useState('')
  const [activeTls, setActiveTls] = useState<Set<TechLevelLike>>(() => new Set())
  const [activeCats, setActiveCats] = useState<Set<string>>(() => new Set())
  const [activeTraits, setActiveTraits] = useState<Set<string>>(() => new Set())
  const [status, setStatus] = useState<'all' | 'equipped' | 'available'>('all')

  // Base pool — the whole collection, optionally narrowed, sorted by TL then name.
  const pool = useMemo(() => {
    const items: PoolEntity[] = SalvageUnionReference.findAllIn(schema, (item) =>
      filter ? filter(item) : true
    )
    return [...items].sort((a, b) => {
      const ta = a.techLevel
      const tb = b.techLevel
      if (ta !== undefined && tb !== undefined && ta !== tb)
        return techLevelRank(ta) - techLevelRank(tb)
      return a.name.localeCompare(b.name)
    })
  }, [schema, filter])

  // Available facet options, derived from the pool. A facet with <2 options is
  // useless, so it hides itself (also hides TL/traits on schemas that lack them).
  const tlOptions = useMemo(() => {
    const present = new Set(
      pool.map((i) => i.techLevel).filter((t): t is TechLevelLike => t != null)
    )
    return ALL_TLS.filter((tl) => present.has(tl))
  }, [pool])

  const traitOptions = useMemo(() => {
    const s = new Set<string>()
    for (const i of pool) for (const t of i.traits ?? []) s.add(t.type)
    return [...s].sort((a, b) => a.localeCompare(b))
  }, [pool])

  const catOptions = useMemo(() => {
    if (!facets?.category) return []
    const s = new Set<string>()
    for (const i of pool) {
      const c = facets.category.of(i)
      if (c) s.add(c)
    }
    return [...s].sort((a, b) => a.localeCompare(b))
  }, [pool, facets])

  const showTl = facets?.techLevel !== false && tlOptions.length >= 2
  const showTraits = facets?.traits !== false && traitOptions.length >= 2
  const showCat = !!facets?.category && catOptions.length >= 2
  const showStatus = !browse && facets?.status !== false

  // Identity helpers — detection and emission share `idOf`.
  const countOf = (item: EntityLike) => selected.filter((ref) => ref === idOf(item)).length

  // Text search preserves the ranked order the package returns.
  const searchOrder = useMemo(() => {
    const q = query.trim()
    if (!q) return null
    const ranked: EntityLike[] = searchIn(schema as SURefEnumSchemaName, q)
    const order = new Map<string, number>()
    ranked.forEach((e, i) => {
      order.set(e.id, i)
    })
    return order
  }, [schema, query])

  const categoryOf = facets?.category?.of

  const visible = useMemo(() => {
    let list = pool
    if (searchOrder) {
      list = list
        .filter((i) => searchOrder.has(i.id))
        .sort((a, b) => (searchOrder.get(a.id) ?? 0) - (searchOrder.get(b.id) ?? 0))
    }
    return list.filter((item) => {
      if (showTl && activeTls.size && !(item.techLevel != null && activeTls.has(item.techLevel)))
        return false
      if (showTraits && activeTraits.size) {
        const types = new Set((item.traits ?? []).map((t) => t.type))
        if (![...activeTraits].some((t) => types.has(t))) return false
      }
      if (showCat && activeCats.size && categoryOf) {
        const c = categoryOf(item)
        if (!(c && activeCats.has(c))) return false
      }
      if (showStatus && status !== 'all') {
        const has = selected.includes(idOf(item))
        if (status === 'equipped' && !has) return false
        if (status === 'available' && has) return false
      }
      return true
    })
  }, [
    pool,
    searchOrder,
    showTl,
    activeTls,
    showTraits,
    activeTraits,
    showCat,
    activeCats,
    categoryOf,
    showStatus,
    status,
    selected,
    idOf,
  ])

  const totalOnSheet = useMemo(
    () => pool.reduce((n, item) => n + selected.filter((ref) => ref === idOf(item)).length, 0),
    [pool, selected, idOf]
  )

  // Facet rows as one config map, rendered through the shared FilterRow. The
  // "Show" row stays separate so the floating sub-header can space the search
  // field OPPOSITE it.
  const facetRows: FacetRowConfig[] = []
  if (showTl)
    facetRows.push({
      label: 'Tech level',
      chips: tlOptions.map((tl) => ({
        key: String(tl),
        label: tlLabel(tl),
        active: activeTls.has(tl),
        onClick: () => toggleIn(activeTls, tl, setActiveTls),
        swatchStyle: tlSwatch(tl),
      })),
    })
  if (showCat && facets?.category)
    facetRows.push({
      label: facets.category.label,
      chips: catOptions.map((c) => ({
        key: c,
        label: c,
        active: activeCats.has(c),
        onClick: () => toggleIn(activeCats, c, setActiveCats),
      })),
    })
  if (showTraits)
    facetRows.push({
      label: 'Traits',
      chips: traitOptions.map((t) => ({
        key: t,
        label: t,
        active: activeTraits.has(t),
        onClick: () => toggleIn(activeTraits, t, setActiveTraits),
      })),
    })
  const showRow: FacetRowConfig | null = showStatus
    ? {
        label: 'Show',
        chips: (
          [
            ['all', 'All'],
            ['equipped', `${chosenLabel} only`],
            ['available', 'Not yet added'],
          ] as const
        ).map(([value, label]) => ({
          key: value,
          label,
          active: status === value,
          onClick: () => setStatus(value),
        })),
      }
    : null

  const activeFilters =
    (showTl ? activeTls.size : 0) +
    (showCat ? activeCats.size : 0) +
    (showTraits ? activeTraits.size : 0) +
    (showStatus && status !== 'all' ? 1 : 0)

  return {
    query,
    setQuery,
    pool,
    visible,
    totalOnSheet,
    countOf,
    facetRows,
    showRow,
    activeFilters,
  }
}
