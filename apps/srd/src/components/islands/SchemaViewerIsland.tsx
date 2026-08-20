import {
  Badge,
  Button,
  EmptyState,
  EntityDetailLinkProvider,
  EntityHrefProvider,
  FilterRow,
  MasonryColumns,
  Skeleton,
  TECH_LEVEL_STYLES,
  techLevelLabel,
} from 'component-lib'
import { Suspense, useEffect, useMemo, useState } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { getEntitySlug, getSource, getTechLevel, getTree } from 'salvageunion-reference'
import { itemHref, srdEntityHref } from '../../lib/entityHref'
import type { SchemaList } from '../../lib/useGameData'
import { GameDataGate } from '../../lib/useGameData'
import { CatalogTile } from './CatalogTile'
import { IslandErrorBoundary } from './IslandErrorBoundary'

// Hoisted to a stable module-level reference.
//
// The original comment justified this by "the `memo()` on ReferenceEntityCard".
// There is no such memo — the card is a plain `export function` and `React.memo`
// appears nowhere in this repo as code. Three separate comments asserted it.
//
// The hoist stays: a fresh inline object per render is what would defeat a memo,
// so a stable identity here is the precondition for adding one, and it is free.
// The cost it describes is real either way — each keystroke in the name filter
// re-renders every card today, unmemoized.

// URL query-param keys the filter state is synced to, so a filtered view is
// bookmarkable/shareable and survives back-navigation.
const PARAM_TECH_LEVEL = 'tl'
const PARAM_SOURCE = 'source'
const PARAM_TREE = 'tree'
const PARAM_NAME = 'q'

/**
 * Read a single query-param value from the current URL. SSR-safe: during
 * `astro build` this island is server-rendered in Node (no `window`), so guard
 * every location read.
 */
function readUrlParam(name: string): string {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get(name) ?? ''
}

/** Read a comma-separated query param into a Set of tokens. */
function readUrlSet(name: string): Set<string> {
  const raw = readUrlParam(name)
  return new Set(raw ? raw.split(',').filter(Boolean) : [])
}

type SchemaViewerIslandProps = {
  initialData: SURefEntity[]
  schemaId: string
  techLevels: (number | 'B' | 'N')[]
  sources: string[]
  /** Ability trees to offer as a filter facet; only abilities carry a tree, so
   *  this defaults to empty and the facet is hidden for every other schema. */
  trees?: string[]
  /** Which schemas to preload — defaults to `'all'`. Pass the per-route list
   *  from `../../lib/schemaPreloadDeps.ts` to load only what this listing needs. */
  preloadSchemas?: SchemaList
}

export function SchemaViewerIsland({
  initialData,
  schemaId,
  techLevels,
  sources,
  trees = [],
  preloadSchemas,
}: SchemaViewerIslandProps) {
  // Filter state initializes from the URL on mount so a shared/bookmarked link
  // restores the exact filtered view. Lazy initializers run once; the reads are
  // window-guarded for SSR.
  const [techLevelFilters, setTechLevelFilters] = useState<Set<string>>(() =>
    readUrlSet(PARAM_TECH_LEVEL)
  )
  const [sourceFilters, setSourceFilters] = useState<Set<string>>(() => readUrlSet(PARAM_SOURCE))
  const [treeFilters, setTreeFilters] = useState<Set<string>>(() => readUrlSet(PARAM_TREE))
  const [nameFilter, setNameFilter] = useState(() => readUrlParam(PARAM_NAME))

  // Push filter state back into the URL (replaceState — bookmarkable/shareable
  // without spamming history on every keystroke). Idempotent: only writes when
  // the resulting query string actually differs from the current one, so the
  // mount-time run never clobbers an incoming shared link.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const setOrDelete = (key: string, value: string) => {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    setOrDelete(PARAM_TECH_LEVEL, [...techLevelFilters].join(','))
    setOrDelete(PARAM_SOURCE, [...sourceFilters].join(','))
    setOrDelete(PARAM_TREE, [...treeFilters].join(','))
    setOrDelete(PARAM_NAME, nameFilter)
    const qs = params.toString()
    const nextUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    const currentUrl = `${window.location.pathname}${window.location.search}`
    if (nextUrl !== currentUrl) {
      window.history.replaceState(window.history.state, '', nextUrl)
    }
  }, [techLevelFilters, sourceFilters, treeFilters, nameFilter])

  const filteredData = useMemo(() => {
    return initialData.filter((item) => {
      if (techLevelFilters.size > 0) {
        const techLevel = getTechLevel(item)
        const itemTechLevel = techLevel?.toString()
        if (!itemTechLevel || !techLevelFilters.has(itemTechLevel)) {
          return false
        }
      }

      if (sourceFilters.size > 0) {
        const itemSource = getSource(item)
        if (!itemSource || !sourceFilters.has(itemSource)) {
          return false
        }
      }

      if (treeFilters.size > 0) {
        const itemTree = getTree(item)
        if (typeof itemTree !== 'string' || !treeFilters.has(itemTree)) {
          return false
        }
      }

      if (nameFilter) {
        if (!item.name.toLowerCase().includes(nameFilter.toLowerCase())) {
          return false
        }
      }

      return true
    })
  }, [initialData, techLevelFilters, sourceFilters, treeFilters, nameFilter])

  const toggleTechLevel = (level: number | 'B' | 'N') => {
    setTechLevelFilters((prev) => {
      if (prev.size === 0) return new Set([String(level)])
      const next = new Set(prev)
      const key = String(level)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      if (techLevels.every((tl) => next.has(String(tl)))) return new Set()
      return next
    })
  }

  const toggleSource = (source: string) => {
    setSourceFilters((prev) => {
      if (prev.size === 0) return new Set([source])
      const next = new Set(prev)
      if (next.has(source)) next.delete(source)
      else next.add(source)
      if (sources.every((s) => next.has(s))) return new Set()
      return next
    })
  }

  const toggleTree = (tree: string) => {
    setTreeFilters((prev) => {
      if (prev.size === 0) return new Set([tree])
      const next = new Set(prev)
      if (next.has(tree)) next.delete(tree)
      else next.add(tree)
      if (trees.every((t) => next.has(t))) return new Set()
      return next
    })
  }

  const hasFilters = techLevels.length > 1 || sources.length > 1 || trees.length > 1
  // Show the name input whenever the dataset is large enough to benefit from it
  const hasNameFilter = initialData.length > 12

  // Browse layout: filters always stack in a bar above the entity grid (at every
  // breakpoint), with the grid spanning full width below them.
  const containerClass = 'mx-auto w-full max-w-[1400px]'
  const showAside = hasFilters || hasNameFilter

  const hasActiveFilters =
    techLevelFilters.size > 0 || sourceFilters.size > 0 || treeFilters.size > 0 || nameFilter !== ''

  const clearFilters = () => {
    setTechLevelFilters(new Set())
    setSourceFilters(new Set())
    setTreeFilters(new Set())
    setNameFilter('')
  }

  return (
    <IslandErrorBoundary>
      <GameDataGate
        schemas={preloadSchemas}
        fallback={
          <div className={containerClass}>
            <div className="w-full min-w-0 px-2 pb-6 md:px-6">
              <MasonryColumns>
                {Array.from({ length: 9 }, (_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static 9-item skeleton placeholder list, never reordered — index is stable
                  <Skeleton key={i} mode="card" compact />
                ))}
              </MasonryColumns>
            </div>
          </div>
        }
      >
        <div className={containerClass}>
          {showAside && (
            <aside className="mb-6 flex w-full flex-col gap-4 px-2 pt-2 md:px-6 print:hidden">
              {/* Search + Tech Level sit side by side on normal-sized screens
                  (md+), stacking on narrow viewports. Source stays on its own row. */}
              {(hasNameFilter || techLevels.length > 1) && (
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
                  {hasNameFilter && (
                    <div className="md:shrink-0">
                      <FilterRow label="Name">
                        <input
                          type="search"
                          name="name-filter"
                          value={nameFilter}
                          onChange={(e) => setNameFilter(e.target.value)}
                          placeholder="Filter by name…"
                          aria-label="Filter items by name"
                          className="w-full rounded-card border border-ink bg-paper px-2 py-1 font-body text-caption md:w-64"
                        />
                      </FilterRow>
                    </div>
                  )}
                  {techLevels.length > 1 && (
                    <div className="md:flex-1">
                      <FilterRow label="Tech Level">
                        <Badge
                          shape="chip"
                          as="button"
                          aria-pressed={techLevelFilters.size === 0}
                          surface={techLevelFilters.size === 0 ? 'solid' : 'ghost'}
                          onClick={() => setTechLevelFilters(new Set())}
                        >
                          All
                        </Badge>
                        {techLevels.map((level) => {
                          const numericLevel = typeof level === 'number' ? level : undefined
                          const swatch =
                            numericLevel !== undefined
                              ? `var(--color-tl-${numericLevel})`
                              : undefined
                          const active = techLevelFilters.has(String(level))
                          return (
                            // Numeric tiers carry a colour swatch; B/N have no swatch and
                            // tint the active fill via TECH_LEVEL_STYLES (className override).
                            <Badge
                              key={String(level)}
                              shape="chip"
                              as="button"
                              aria-pressed={active}
                              surface={active ? 'solid' : 'ghost'}
                              swatch={swatch}
                              className={
                                active && !swatch ? TECH_LEVEL_STYLES[String(level)] : undefined
                              }
                              onClick={() => toggleTechLevel(level)}
                            >
                              {techLevelLabel(level)}
                            </Badge>
                          )
                        })}
                      </FilterRow>
                    </div>
                  )}
                </div>
              )}

              {sources.length > 1 && (
                <FilterRow label="Source">
                  <Badge
                    shape="chip"
                    as="button"
                    aria-pressed={sourceFilters.size === 0}
                    surface={sourceFilters.size === 0 ? 'solid' : 'ghost'}
                    onClick={() => setSourceFilters(new Set())}
                  >
                    All
                  </Badge>
                  {sources.map((source) => (
                    <Badge
                      key={source}
                      shape="chip"
                      as="button"
                      aria-pressed={sourceFilters.has(source)}
                      surface={sourceFilters.has(source) ? 'solid' : 'ghost'}
                      onClick={() => toggleSource(source)}
                    >
                      {source}
                    </Badge>
                  ))}
                </FilterRow>
              )}

              {trees.length > 1 && (
                <FilterRow label="Tree">
                  <Badge
                    shape="chip"
                    as="button"
                    aria-pressed={treeFilters.size === 0}
                    surface={treeFilters.size === 0 ? 'solid' : 'ghost'}
                    onClick={() => setTreeFilters(new Set())}
                  >
                    All
                  </Badge>
                  {trees.map((tree) => (
                    <Badge
                      key={tree}
                      shape="chip"
                      as="button"
                      aria-pressed={treeFilters.has(tree)}
                      surface={treeFilters.has(tree) ? 'solid' : 'ghost'}
                      onClick={() => toggleTree(tree)}
                    >
                      {tree}
                    </Badge>
                  ))}
                </FilterRow>
              )}
            </aside>
          )}

          {/* Entity Grid */}
          <div className="w-full min-w-0 px-2 pb-6 md:px-6">
            {filteredData.length === 0 ? (
              <EmptyState
                className="m-4"
                headline="Nothing here"
                body="No items match the current filters."
                action={
                  hasActiveFilters ? (
                    <Button variant="primary" size="mini" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <EntityHrefProvider value={srdEntityHref}>
                <EntityDetailLinkProvider value={true}>
                  <MasonryColumns>
                    {filteredData.map((item: SURefEntity) => (
                      <Suspense key={item.id} fallback={<Skeleton mode="card" compact />}>
                        <CatalogTile entity={item} href={itemHref(schemaId, getEntitySlug(item))} />
                      </Suspense>
                    ))}
                  </MasonryColumns>
                </EntityDetailLinkProvider>
              </EntityHrefProvider>
            )}
          </div>
        </div>
      </GameDataGate>
    </IslandErrorBoundary>
  )
}
