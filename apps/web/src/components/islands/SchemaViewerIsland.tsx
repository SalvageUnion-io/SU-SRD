import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { RefAbility, RefEntity } from 'salvageunion-reference'
import {
  getAssetUrl,
  getEntitySlug,
  getModel,
  getSources,
  getTechLevel,
  getTree,
} from 'salvageunion-reference'
import { itemHref, srdHrefFor } from '../../lib/entityHref'
import type { GroupBy, ListingShape, TechLevel } from '../../lib/listingGroups'
import {
  catalogGroupBy,
  groupEntities,
  orderTechLevels,
  resolveGroupBy,
  tlName,
  WIDE_LISTINGS,
} from '../../lib/listingGroups'
import {
  PARAM_NAME,
  PARAM_SOURCE,
  PARAM_TECH_LEVEL,
  PARAM_TREE,
  PARAM_VIEW,
} from '../../lib/listingParams'
import type { ListingView } from '../../lib/listingView'
import { TREE_LISTINGS, useListingView } from '../../lib/listingView'
import type { SchemaList } from '../../lib/useGameData'
import { preloadGameData } from '../../lib/useGameData'
import { islandsCopy } from '../../messages/components-islands'
import { GameDataGate } from '../GameDataGate'
import {
  Button,
  EmptyState,
  Entity,
  EntitySurfaceProvider,
  Skeleton,
  Slab,
  tokens,
  trackForTree,
} from '../index'
import { ReferenceAbilityTrack } from '../ReferenceAbilityTrack'
import { IslandErrorBoundary } from './IslandErrorBoundary'
import type { ListingBand } from './ListingFrame'
import { ListingFrame } from './ListingFrame'
import type { RailActions } from './ListingRail'
import { ListingRail, shortSource, tlButtonLabel } from './ListingRail'

/**
 * The schemas whose entity IS a tech level: its name already says the level.
 * A crawler tech level's ("Hamlet Crawler") does not, so its tile shows its TL
 * chip.
 */
const TECH_LEVEL_SCHEMAS: ReadonlySet<string> = new Set(['tech-levels'])
/** Cargo and Heat: a tile's chips sit beside its name, so only its page prints them. */
const TILE_OMIT = ['ref-stat-cargoCapacity', 'ref-stat-heatCapacity']
/**
 * The Catalog's opening row: four tiles at the page's measure (17rem tracks,
 * `pages.css`), one on a phone. Their art is the page's largest paint, so it
 * loads at once and first rather than lazily after layout.
 */
const OPENING_ROW = 4

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
  /** The page's band; without one the rail heads the listing itself. */
  band?: ListingBand
  techLevels: TechLevel[]
  sources: string[]
  /** Ability trees to offer as a filter facet; only abilities carry a tree, so
   *  this defaults to empty and the facet is hidden for every other schema. */
  trees?: string[]
  /** Which schemas to preload — defaults to `'all'`. Pass the per-route list
   *  from `../../lib/schemaPreloadDeps.ts` to load only what this listing needs. */
  preloadSchemas?: SchemaList
  /** Whether any entity in the schema has artwork: then the Catalog is the
   *  default at a desktop measure (`listingView.ts`). */
  hasArt?: boolean
  /** The unfiltered listing's size and groups, from build-time data: the
   *  skeleton sets the rail and the group headings where the grid will put
   *  them. Without it the skeleton is a flat run of placeholders. */
  shape?: ListingShape
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
  shape,
  ...props
}: SchemaViewerIslandProps) {
  // Resolved here, above the gate, so the skeletons already take the view's shape.
  const listingView = useListingView(props.schemaId)
  return (
    <IslandErrorBoundary>
      <GameDataGate
        schemas={preloadSchemas}
        projection="list"
        fallback={
          <ListingSkeleton
            {...props}
            hasArt={hasArt}
            shape={shape}
            view={listingView.view}
            views={listingView.views}
          />
        }
      >
        <SchemaViewer {...props} hasArt={hasArt} listingView={listingView} />
      </GameDataGate>
    </IslandErrorBoundary>
  )
}

/**
 * The schemas the island reads, loaded before its first render
 * (`islandRegistry`): the island mounts with `createRoot`, so a first commit
 * of the skeleton would replace the server's finished listing with
 * placeholders, and the listing would paint a second time when the data came.
 * With the data in hand the first commit draws the same listing over it.
 */
export function prepareSchemaViewerIsland(props: Record<string, unknown>): Promise<void> {
  const schemas = Array.isArray(props.preloadSchemas)
    ? props.preloadSchemas.filter((schema): schema is string => typeof schema === 'string')
    : 'all'
  return preloadGameData(schemas, 'list')
}

/**
 * The island's listing as the server renders it, from build-time data: the
 * same markup the island's first commit draws over it, so the mount repaints
 * nothing (and a crawler or a no-JS reader gets the cards). The island mounts
 * only when a reader reaches for the rail (`interaction`), so until then this
 * is the page; the rail's controls take the press that wakes it.
 */
export function SchemaViewerListing({
  preloadSchemas: _preloadSchemas,
  hasArt = false,
  shape: _shape,
  ...props
}: SchemaViewerIslandProps) {
  const listingView = useListingView(props.schemaId)
  return <SchemaViewer {...props} hasArt={hasArt} listingView={listingView} serverRender />
}

/** Rendered only behind the gate: `getModel(…).all()` throws on an unloaded schema. */
function SchemaViewer({
  schemaId,
  band,
  entryIds,
  techLevels,
  sources,
  trees = [],
  hasArt,
  listingView,
  serverRender = false,
}: Omit<SchemaViewerIslandProps, 'preloadSchemas' | 'shape'> & {
  listingView: ReturnType<typeof useListingView>
  /** The server render: the rail has no actions until the island mounts. */
  serverRender?: boolean
}) {
  const { view, views, setView, fromUrl: viewInUrl } = listingView
  const initialData = useMemo(() => {
    const all = getModel(schemaId)?.all() ?? []
    if (!entryIds) return all
    const listed = new Set(entryIds)
    return all.filter((item) => listed.has(item.id))
  }, [schemaId, entryIds])

  // A catalog with art keeps every tile's art place: an art-less entity wears a
  // censor mark, turned by its place among the listing's art-less entities.
  const missingArt = useMemo(() => {
    if (!hasArt) return undefined
    const order = new Map<string, number>()
    for (const item of initialData) if (!getAssetUrl(item)) order.set(item.id, order.size)
    return order
  }, [hasArt, initialData])

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
      if (sourceFilter && !getSources(item).includes(sourceFilter)) return false
      if (treeFilter && getTree(item) !== treeFilter) return false
      if (name && !item.name.toLowerCase().includes(name)) return false
      return true
    })
  }, [initialData, techLevelFilters, sourceFilter, treeFilter, nameFilter])

  const orderedTechLevels = useMemo(() => orderTechLevels(techLevels), [techLevels])
  // The Catalog is one flat grid, no group headings (a tree listing's by
  // name), but for the classes' Core and Hybrid headings; the Tree groups.
  const flat = view === 'catalog'
  const groupBy: GroupBy = flat
    ? catalogGroupBy(schemaId)
    : resolveGroupBy(initialData, trees, orderedTechLevels, schemaId)
  const byName = flat && TREE_LISTINGS.has(schemaId)
  const groups = useMemo(
    () =>
      groupEntities(
        byName ? [...filteredData].sort((a, b) => a.name.localeCompare(b.name)) : filteredData,
        groupBy
      ),
    [filteredData, groupBy, byName]
  )
  // The Tree draws each tree on its track, as the class page does: a Core,
  // Advanced or Hybrid tree's tiers 1-2-3, a Legendary tree's "or".
  const treeTracks = useMemo(
    () =>
      new Map(
        groupBy === 'tree'
          ? groups.map((group) => [group.key, trackForTree(group.items as RefAbility[])])
          : []
      ),
    [groups, groupBy]
  )
  // A single-kind listing: no type stamp, and no TL cell when the tech level
  // heads the group or names the entity (a tech-level listing's "Tech 3").
  const omit = useMemo(
    () =>
      groupBy === 'tl' || TECH_LEVEL_SCHEMAS.has(schemaId) ? ['kind', 'tech-level'] : ['kind'],
    [groupBy, schemaId]
  )
  // A tile carries its stats beside the name, so it keeps to the ones that
  // pick a Mech or drone; its page shows every stat.
  const tileOmit = useMemo(() => [...omit, ...TILE_OMIT], [omit])

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

  const rail = (
    <ListingRail
      facets={{
        count: initialData.length,
        techLevels: orderedTechLevels,
        sources,
        trees,
        views,
      }}
      filters={{
        techLevels: techLevelFilters,
        source: sourceFilter,
        tree: treeFilter,
        name: nameFilter,
      }}
      facetsOpen={facetsOpen}
      view={view}
      actions={serverRender ? undefined : railActions}
      awaitsIsland={serverRender}
      // What is filtered, only while something is: the count, a token per
      // filter that removes it, and Clear all.
      status={
        hasActiveFilters &&
        filteredData.length > 0 && (
          <output className="su-rail__status" aria-live="polite">
            <span className="su-rail__tally">
              {islandsCopy('of', { count: filteredData.length, count2: initialData.length })}
            </span>
            {[...techLevelFilters].map((key) => {
              const level = orderedTechLevels.find((tl) => String(tl) === key)
              if (level == null) return null
              return (
                <FilterToken
                  key={key}
                  label={
                    typeof level === 'number' ? islandsCopy('tl2', { level }) : tlButtonLabel(level)
                  }
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
            <Button variant="ghost" size="compact" onClick={clearFilters}>
              {islandsCopy('clearAll')}
            </Button>
          </output>
        )
      }
    />
  )

  return (
    <ListingFrame band={band} rail={rail}>
      <div
        className="su-listing"
        data-wide={WIDE_LISTINGS.has(schemaId) || undefined}
        data-catalog={(view === 'catalog' && !hasArt) || undefined}
        data-view={view}
      >
        {!band && rail}

        {filteredData.length === 0 ? (
          <EmptyState
            headline={islandsCopy('nothingHere')}
            body={islandsCopy('noItemsMatchTheCurrent')}
            action={
              hasActiveFilters ? (
                <Button variant="primary" size="mini" onClick={clearFilters}>
                  {islandsCopy('clearFilters')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <EntitySurfaceProvider value={{ hrefFor: srdHrefFor }}>
            <div className="su-listing__groups">
              {groups.map((group, groupIndex) => (
                <section key={group.key} className="su-listing__group" aria-label={group.label}>
                  {group.label && <Slab label={group.label} />}
                  {view === 'catalog' ? (
                    <ul className="su-listing__tiles">
                      {group.items.map((item: RefEntity, index) => (
                        <li key={item.id}>
                          <Entity
                            size="compact"
                            layout="index"
                            entity={item}
                            mode={{ kind: 'link', href: itemHref(schemaId, getEntitySlug(item)) }}
                            omit={tileOmit}
                            lead
                            priority={groupIndex === 0 && index < OPENING_ROW}
                            missingArt={missingArt?.get(item.id)}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : treeTracks.get(group.key) ? (
                    <ReferenceAbilityTrack
                      abilities={group.items as RefAbility[]}
                      track={treeTracks.get(group.key) ?? 'core'}
                    />
                  ) : (
                    <ul className="su-listing__cards" data-entity-fit="">
                      {group.items.map((item: RefEntity) => (
                        <li key={item.id}>
                          {/* One card, one click (ruleset §1, E2, E11): a
                              Compact in link mode, the whole row an `<a>`. */}
                          <Entity
                            size="compact"
                            entity={item}
                            mode={{ kind: 'link', href: itemHref(schemaId, getEntitySlug(item)) }}
                            omit={omit}
                            lead
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
    </ListingFrame>
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
  band,
  techLevels,
  sources,
  trees = [],
  hasArt,
  shape,
  view,
  views,
}: Omit<SchemaViewerIslandProps, 'preloadSchemas'> & {
  view: ListingView
  views: readonly ListingView[]
}) {
  const catalog = view === 'catalog'
  // The shape is the default view's groups; the Catalog is one, but for the
  // classes' headings.
  const groups =
    shape && (!catalog || catalogGroupBy(schemaId) !== 'none')
      ? shape.groups
      : [{ key: 'all', label: undefined, count: shape?.count ?? 12 }]
  const rail = shape && (
    <ListingRail
      facets={{
        count: shape.count,
        techLevels: orderTechLevels(techLevels),
        sources,
        trees,
        views,
      }}
      view={view}
    />
  )
  return (
    <ListingFrame band={band} rail={rail}>
      <div
        className="su-listing"
        data-wide={WIDE_LISTINGS.has(schemaId) || undefined}
        data-catalog={(catalog && !hasArt) || undefined}
        data-view={view}
        aria-hidden="true"
      >
        {!band && rail}
        <div className="su-listing__groups">
          {groups.map((group) => (
            <section key={group.key} className="su-listing__group">
              {group.label && <Slab label={group.label} />}
              {catalog ? (
                <ul className="su-listing__tiles">
                  {Array.from({ length: group.count }, (_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder list, never reordered — index is stable
                    <li key={i} className="su-listing__tile-skeleton" />
                  ))}
                </ul>
              ) : (
                <ul className="su-listing__cards" data-entity-grid="">
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
    </ListingFrame>
  )
}

/** One active filter, as a Compact Button that removes it (its ✕ the line's Size). */
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
    <Button size="compact" aria-label={islandsCopy('remove', { name })} onClick={onRemove}>
      {label}
      <X aria-hidden="true" size={tokens.iconSize.compact} />
    </Button>
  )
}
