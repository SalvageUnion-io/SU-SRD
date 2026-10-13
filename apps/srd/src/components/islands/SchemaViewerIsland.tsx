import { Button, EmptyState, Entity, EntitySurfaceProvider, Skeleton, Slab } from 'component-lib'
import { useEffect, useMemo, useState } from 'react'
import type { SURefAbility, SURefEntity } from 'salvageunion-reference'
import { getEntitySlug, getModel, getSource, getTechLevel, getTree } from 'salvageunion-reference'
import { itemHref, srdHrefFor } from '../../lib/entityHref'
import type { ListingShape, TechLevel } from '../../lib/listingGroups'
import {
  groupEntities,
  orderTechLevels,
  resolveGroupBy,
  tlName,
  WIDE_LISTINGS,
} from '../../lib/listingGroups'
import type { ListingView } from '../../lib/listingView'
import { PARAM_VIEW, useListingView } from '../../lib/listingView'
import type { SchemaList } from '../../lib/useGameData'
import { GameDataGate } from '../../lib/useGameData'
import { AbilityTrack, trackForTree } from '../AbilityTrack'
import { EntityListingRow } from './EntityListingRow'
import { IslandErrorBoundary } from './IslandErrorBoundary'
import type { RailActions } from './ListingRail'
import { ListingRail, shortSource, tlButtonLabel } from './ListingRail'

// URL query-param keys the filter state is synced to, so a filtered view is
// bookmarkable/shareable and survives back-navigation.
const PARAM_TECH_LEVEL = 'tl'
const PARAM_SOURCE = 'source'
const PARAM_TREE = 'tree'
const PARAM_NAME = 'q'

/** The schemas whose entity IS a tech level: its name already says the level. */
const TECH_LEVEL_SCHEMAS: ReadonlySet<string> = new Set(['tech-levels', 'crawler-tech-levels'])
/**
 * Read a single query-param value from the current URL. SSR-safe: the SSG
 * renders this island's `ssr` markup under Bun (no `window`), so guard every
 * location read.
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

/** A single-choice param; an older shared link's comma list keeps its first entry. */
function readUrlChoice(name: string): string {
  return readUrlParam(name).split(',')[0] ?? ''
}

type SchemaViewerIslandProps = {
  schemaId: string
  techLevels: TechLevel[]
  sources: string[]
  /** Ability trees to offer as a filter facet; only abilities carry a tree, so
   *  this defaults to empty and the facet is hidden for every other schema. */
  trees?: string[]
  /** Which schemas to preload — defaults to `'all'`. Pass the per-route list
   *  from `../../lib/schemaPreloadDeps.ts` to load only what this listing needs. */
  preloadSchemas?: SchemaList
  /** Whether any entity in the schema has artwork: only then is there a
   *  Catalog view (the default at a desktop measure, `listingView.ts`). */
  hasArt?: boolean
  /** The unfiltered listing's size and groups, from build-time data: the
   *  skeleton sets the rail and the group headings where the grid will put
   *  them. Without it the skeleton is a flat run of placeholders. */
  shape?: ListingShape
  /** A Catalog at every width (`CATALOG_LISTINGS`): one grid of tiles, each
   *  on its own plate. The page passes it no tech levels, so it has no
   *  groups and no TL facet. */
  catalogOnly?: boolean
  /** The ids the listing lists, when it lists fewer than its schema holds
   *  (the roll tables list only their top-level tables,
   *  `lib/listingEntries.ts`); absent, it lists every entry. */
  entryIds?: readonly string[]
}

/**
 * The listing's entities are not a prop: inlined into the page they were up to
 * 162 KB of JSON per listing. The schema is already in `preloadSchemas` (see
 * `getSchemaPreloadList`), so the grid reads it from the ORM once the gate
 * opens — the same `getModel(id).all()` the page builds from.
 *
 * A listing row never prints an action's prose, so it loads `actions` as its
 * list projection (`projection="list"`): a fraction of the full chunk. A
 * listing row renders the same from either copy
 * (`src/lib/__tests__/preloadEquivalence.tsx`).
 */
export function SchemaViewerIsland({
  preloadSchemas,
  hasArt = false,
  catalogOnly = false,
  shape,
  ...props
}: SchemaViewerIslandProps) {
  // Resolved here, above the gate, so the skeletons already take the view's shape.
  const listingView = useListingView(hasArt, catalogOnly)
  return (
    <IslandErrorBoundary>
      <GameDataGate
        schemas={preloadSchemas}
        projection="list"
        fallback={
          <ListingSkeleton
            {...props}
            hasArt={hasArt}
            catalogOnly={catalogOnly}
            shape={shape}
            view={listingView.view}
          />
        }
      >
        <SchemaViewer
          {...props}
          hasArt={hasArt}
          catalogOnly={catalogOnly}
          listingView={listingView}
        />
      </GameDataGate>
    </IslandErrorBoundary>
  )
}

/** Rendered only behind the gate: `getModel(…).all()` throws on an unloaded schema. */
function SchemaViewer({
  schemaId,
  entryIds,
  techLevels,
  sources,
  trees = [],
  hasArt,
  catalogOnly,
  listingView,
}: Omit<SchemaViewerIslandProps, 'preloadSchemas' | 'shape'> & {
  listingView: ReturnType<typeof useListingView>
}) {
  const { view, setView, fromUrl: viewInUrl } = listingView
  const initialData = useMemo(() => {
    const all = getModel(schemaId)?.all() ?? []
    if (!entryIds) return all
    const listed = new Set(entryIds)
    return all.filter((item) => listed.has(item.id))
  }, [schemaId, entryIds])

  // Filter state initializes from the URL on mount so a shared/bookmarked link
  // restores the exact filtered view. Lazy initializers run once; the reads are
  // window-guarded for SSR.
  const [techLevelFilters, setTechLevelFilters] = useState<Set<string>>(() =>
    readUrlSet(PARAM_TECH_LEVEL)
  )
  const [sourceFilter, setSourceFilter] = useState(() => readUrlChoice(PARAM_SOURCE))
  const [treeFilter, setTreeFilter] = useState(() => readUrlChoice(PARAM_TREE))
  const [nameFilter, setNameFilter] = useState(() => readUrlParam(PARAM_NAME))
  // On a phone the facets fold behind one button (the CSS decides when).
  const [facetsOpen, setFacetsOpen] = useState(false)

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
    setOrDelete(PARAM_SOURCE, sourceFilter)
    setOrDelete(PARAM_TREE, treeFilter)
    setOrDelete(PARAM_NAME, nameFilter)
    setOrDelete(PARAM_VIEW, viewInUrl ? view : '')
    const qs = params.toString()
    const nextUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    const currentUrl = `${window.location.pathname}${window.location.search}`
    if (nextUrl !== currentUrl) {
      window.history.replaceState(window.history.state, '', nextUrl)
    }
  }, [techLevelFilters, sourceFilter, treeFilter, nameFilter, view, viewInUrl])

  const filteredData = useMemo(() => {
    const name = nameFilter.toLowerCase()
    return initialData.filter((item) => {
      if (techLevelFilters.size > 0) {
        const itemTechLevel = getTechLevel(item)?.toString()
        if (!itemTechLevel || !techLevelFilters.has(itemTechLevel)) return false
      }
      if (sourceFilter && getSource(item) !== sourceFilter) return false
      if (treeFilter && getTree(item) !== treeFilter) return false
      if (name && !item.name.toLowerCase().includes(name)) return false
      return true
    })
  }, [initialData, techLevelFilters, sourceFilter, treeFilter, nameFilter])

  const orderedTechLevels = useMemo(() => orderTechLevels(techLevels), [techLevels])
  const groupBy = resolveGroupBy(initialData, trees, orderedTechLevels, schemaId)
  const groups = useMemo(() => groupEntities(filteredData, groupBy), [filteredData, groupBy])
  // An ability listing draws each tree on its track, as the class page does:
  // a Core, Advanced or Hybrid tree's tiers 1-2-3, a Legendary tree's "or".
  const treeTracks = useMemo(
    () =>
      new Map(
        groupBy === 'tree'
          ? groups.map((group) => [group.key, trackForTree(group.items as SURefAbility[])])
          : []
      ),
    [groups, groupBy]
  )
  // A single-kind listing: no type stamp, and no TL cell when the tech level
  // heads the group or names the tile (a tech-level listing's "Tech 3").
  const omit = useMemo(
    () =>
      groupBy === 'tl' || (catalogOnly && TECH_LEVEL_SCHEMAS.has(schemaId))
        ? ['kind', 'tech-level']
        : ['kind'],
    [groupBy, catalogOnly, schemaId]
  )

  const toggleTechLevel = (level: TechLevel) => {
    setTechLevelFilters((prev) => {
      const next = new Set(prev)
      const key = String(level)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      if (orderedTechLevels.every((tl) => next.has(String(tl)))) return new Set()
      return next
    })
  }

  const activeFacets = techLevelFilters.size + (sourceFilter ? 1 : 0) + (treeFilter ? 1 : 0)
  const hasActiveFilters = activeFacets > 0 || nameFilter !== ''
  const clearFilters = () => {
    setTechLevelFilters(new Set())
    setSourceFilter('')
    setTreeFilter('')
    setNameFilter('')
  }
  const railActions: RailActions = {
    setName: setNameFilter,
    toggleTechLevel,
    clearTechLevels: () => setTechLevelFilters(new Set()),
    setSource: setSourceFilter,
    setTree: setTreeFilter,
    setView,
    toggleFacets: () => setFacetsOpen((open) => !open),
  }

  return (
    <div
      className="srd-listing"
      data-wide={WIDE_LISTINGS.has(schemaId) || undefined}
      data-catalog={catalogOnly || undefined}
      data-view={view}
    >
      <ListingRail
        facets={{
          count: initialData.length,
          techLevels: orderedTechLevels,
          sources,
          trees,
          hasArt: !!hasArt,
        }}
        filters={{
          techLevels: techLevelFilters,
          source: sourceFilter,
          tree: treeFilter,
          name: nameFilter,
        }}
        facetsOpen={facetsOpen}
        view={view}
        actions={railActions}
      />

      {/* What is filtered, only while something is: the count, a token per
          filter that removes it, and Clear all. */}
      {hasActiveFilters && filteredData.length > 0 && (
        <output className="srd-rail__status" aria-live="polite">
          <span className="srd-rail__tally">
            {filteredData.length} of {initialData.length}
          </span>
          {[...techLevelFilters].map((key) => {
            const level = orderedTechLevels.find((tl) => String(tl) === key)
            if (level == null) return null
            return (
              <FilterToken
                key={key}
                label={typeof level === 'number' ? `TL ${level}` : tlButtonLabel(level)}
                name={tlName(level)}
                onRemove={() => toggleTechLevel(level)}
              />
            )
          })}
          {sourceFilter && (
            <FilterToken
              label={shortSource(sourceFilter)}
              name={`source ${sourceFilter}`}
              onRemove={() => setSourceFilter('')}
            />
          )}
          {treeFilter && (
            <FilterToken
              label={treeFilter}
              name={`tree ${treeFilter}`}
              onRemove={() => setTreeFilter('')}
            />
          )}
          {nameFilter && (
            <FilterToken
              label={`“${nameFilter}”`}
              name="name filter"
              onRemove={() => setNameFilter('')}
            />
          )}
          <button type="button" className="srd-rail__clear su-focus-ring" onClick={clearFilters}>
            Clear all
          </button>
        </output>
      )}

      {filteredData.length === 0 ? (
        <EmptyState
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
        <EntitySurfaceProvider value={{ hrefFor: srdHrefFor }}>
          <div
            className="srd-listing__groups"
            data-trees={(groupBy === 'tree' && view !== 'catalog') || undefined}
          >
            {groups.map((group) => (
              <section key={group.key} className="srd-listing__group" aria-label={group.label}>
                {group.label && <Slab variant="solid" label={group.label} />}
                {view === 'catalog' ? (
                  <ul className="srd-listing__tiles">
                    {group.items.map((item: SURefEntity) => (
                      <li key={item.id}>
                        <Entity
                          form="tile"
                          entity={item}
                          mode={{ kind: 'link', href: itemHref(schemaId, getEntitySlug(item)) }}
                          omit={omit}
                          lead
                        />
                      </li>
                    ))}
                  </ul>
                ) : treeTracks.get(group.key) ? (
                  <AbilityTrack
                    abilities={group.items as SURefAbility[]}
                    track={treeTracks.get(group.key) ?? 'core'}
                  />
                ) : (
                  <ul className="srd-listing__cards" data-entity-fit="">
                    {group.items.map((item: SURefEntity) => (
                      <li key={item.id}>
                        <EntityListingRow
                          entity={item}
                          href={itemHref(schemaId, getEntitySlug(item))}
                          omit={omit}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </EntitySurfaceProvider>
      )}
    </div>
  )
}

/**
 * The listing while its schema loads: the rail as its inert placeholder, then
 * the default groups under their headings, a placeholder per entity in the
 * view's shape — the server render's layout, so neither the gate opening nor
 * the mount before it moves the grid.
 */
function ListingSkeleton({
  schemaId,
  techLevels,
  sources,
  trees = [],
  hasArt,
  catalogOnly,
  shape,
  view,
}: Omit<SchemaViewerIslandProps, 'preloadSchemas'> & { view: ListingView }) {
  const catalog = view === 'catalog'
  const groups = shape?.groups ?? [{ key: 'all', label: undefined, count: catalog ? 12 : 9 }]
  return (
    <div
      className="srd-listing"
      data-wide={WIDE_LISTINGS.has(schemaId) || undefined}
      data-catalog={catalogOnly || undefined}
      data-view={view}
      aria-hidden="true"
    >
      {shape && (
        <ListingRail
          facets={{
            count: shape.count,
            techLevels: orderTechLevels(techLevels),
            sources,
            trees,
            hasArt: !!hasArt,
          }}
          view={view}
        />
      )}
      {/* An ability listing's trees sit side by side, as the island lays them. */}
      <div className="srd-listing__groups" data-trees={(trees.length > 1 && !catalog) || undefined}>
        {groups.map((group) => (
          <section key={group.key} className="srd-listing__group">
            {group.label && <Slab variant="solid" label={group.label} />}
            {catalog ? (
              <ul className="srd-listing__tiles">
                {Array.from({ length: group.count }, (_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder list, never reordered — index is stable
                  <li key={i} className="srd-listing__tile-skeleton" />
                ))}
              </ul>
            ) : (
              <ul className="srd-listing__cards" data-entity-grid="">
                {Array.from({ length: group.count }, (_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder list, never reordered — index is stable
                  <li key={i}>
                    <Skeleton />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}

/** One active filter, as a token that removes it. */
function FilterToken({
  label,
  name,
  onRemove,
}: {
  label: string
  name: string
  onRemove: () => void
}) {
  return (
    <button
      type="button"
      className="srd-rail__token su-focus-ring"
      aria-label={`Remove ${name}`}
      onClick={onRemove}
    >
      {label}
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  )
}
