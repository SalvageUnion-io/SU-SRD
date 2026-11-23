import { useLayoutEffect, useMemo, useState } from 'react'
import type { RefAbility, RefEntity } from 'salvageunion-reference'
import {
  getEntitySlug,
  getModel,
  getSources,
  getTechLevel,
  getTree,
  toEntityModel,
} from 'salvageunion-reference'
import { itemHref, srdHrefFor } from '../../lib/entityHref'
import type { ListingFieldFacets } from '../../lib/listingFacets'
import { dealsDamage, entityAction, entityRanges } from '../../lib/listingFacets'
import type { GroupBy, ListingShape, TechLevel } from '../../lib/listingGroups'
import {
  catalogGroupBy,
  groupEntities,
  orderTechLevels,
  resolveGroupBy,
} from '../../lib/listingGroups'
import { keepListingScroll } from '../../lib/listingScroll'
import { entityTraitNames } from '../../lib/listingTraits'
import type { ListingView } from '../../lib/listingView'
import { TREE_LISTINGS, useListingView } from '../../lib/listingView'
import { nameMatches } from '../../lib/nameMatch'
import { classDrawingTree } from '../../lib/rules/classPath'
import { artUrlFor } from '../../lib/sourceCovers'
import type { SchemaList } from '../../lib/useGameData'
import { preloadGameData } from '../../lib/useGameData'
import { useListingFilters } from '../../lib/useListingFilters'
import { islandsCopy } from '../../messages/components-islands'
import { clientSwap } from '../../runtime/clientSwap'
import { GameDataGate } from '../GameDataGate'
import {
  Button,
  EmptyState,
  Entity,
  EntitySurfaceProvider,
  Skeleton,
  Slab,
  trackForTree,
} from '../index'
import { ReferenceAbilityTrack } from '../ReferenceAbilityTrack'
import { IndexLedger } from './IndexLedger'
import { IslandErrorBoundary } from './IslandErrorBoundary'
import { sortIndexItems } from './indexColumns.model'
import { ListingFilterStatus } from './ListingFilterStatus'
import type { ListingBand } from './ListingFrame'
import { ListingFrame } from './ListingFrame'
import type { RailActions } from './ListingRail'
import {
  focusFirstResult,
  ListingPrinted,
  ListingRail,
  RESULTS_ID,
  TOOLBAR_MIN_ENTRIES,
} from './ListingRail'

type RailPart = 'all' | 'view' | 'filters'

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

/** Whose tree it is, beside its heading: the class whose page draws it. */
const treeOwner = (tree: string) => classDrawingTree(tree)?.name

type SchemaViewerIslandProps = {
  schemaId: string
  /** The page's band; without one the rail heads the listing itself. */
  band?: ListingBand
  techLevels: TechLevel[]
  sources: string[]
  /** Ability trees to offer as a filter facet; only abilities carry a tree, so
   *  this defaults to empty and the facet is hidden for every other schema. */
  trees?: string[]
  /** The traits to offer as a filter facet (`listingTraits`): the weapons' and gear's. */
  traits?: string[]
  /** Range, Action and Weapons only, from the List's columns (`listingFieldFacets`): Systems'. */
  fields?: ListingFieldFacets
  /** Which schemas to preload — defaults to `'all'`. Pass the per-route list
   *  from `../../lib/schemaPreloadDeps.ts` to load only what this listing needs. */
  preloadSchemas?: SchemaList
  /** Whether any entity in the schema has artwork: its Catalog keeps every
   *  tile's art place; without, the Catalog takes the wider art-less columns. */
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
 * The schemas the island reads, loaded before it swaps in (`clientSwap`'s
 * `prepare`): a first commit of the skeleton would replace the server's
 * finished listing with placeholders, and the listing would paint a second
 * time when the data came. With the data in hand the first commit draws the
 * same listing over it.
 */
function prepareSchemaViewerIsland(props: Record<string, unknown>): Promise<void> {
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
  traits = [],
  fields,
  hasArt,
  listingView,
  serverRender = false,
}: Omit<SchemaViewerIslandProps, 'preloadSchemas' | 'shape'> & {
  listingView: ReturnType<typeof useListingView>
  /** The server render: the rail has no actions until the island mounts. */
  serverRender?: boolean
}) {
  const { view, views, setView, fromUrl: viewInUrl } = listingView
  // Back lands on the row the reader left, once these rows are in place.
  useLayoutEffect(() => (serverRender ? undefined : keepListingScroll()), [serverRender])
  const initialData = useMemo(() => {
    const all = getModel(schemaId)?.all() ?? []
    if (!entryIds) return all
    const listed = new Set(entryIds)
    return all.filter((item) => listed.has(item.id))
  }, [schemaId, entryIds])

  // A catalog with art keeps every tile's art place: an art-less entity wears a
  // "No illustration" plate there (`NoArtPlate`).
  const missingArt = useMemo(() => {
    if (!hasArt) return undefined
    const order = new Map<string, number>()
    for (const item of initialData) if (!artUrlFor(item)) order.set(item.id, order.size)
    return order
  }, [hasArt, initialData])

  const orderedTechLevels = useMemo(() => orderTechLevels(techLevels), [techLevels])
  // The filters, the sort and a phone's columns open on the URL's query and
  // write themselves back to it: a shared link restores the exact view.
  const filters = useListingFilters({
    schemaId,
    techLevels: orderedTechLevels,
    view,
    viewInUrl,
  })
  const {
    techLevelFilters,
    source: sourceFilter,
    tree: treeFilter,
    trait: traitFilter,
    range: rangeFilter,
    action: actionFilter,
    weapons: weaponsOnly,
    name: nameFilter,
    toggleTechLevel,
    clear: clearFilters,
  } = filters
  // On a phone the facets fold behind one button (the CSS decides when).
  const [facetsOpen, setFacetsOpen] = useState(false)

  const filteredData = useMemo(() => {
    return initialData.filter((item) => {
      if (techLevelFilters.size > 0) {
        const itemTechLevel = getTechLevel(item)?.toString()
        if (!itemTechLevel || !techLevelFilters.has(itemTechLevel)) return false
      }
      if (sourceFilter && !getSources(item).includes(sourceFilter)) return false
      if (treeFilter && getTree(item) !== treeFilter) return false
      if (traitFilter && !entityTraitNames(toEntityModel(item)).includes(traitFilter)) return false
      // The name filter forgives the slips the site search forgives (r4 E14).
      if (nameFilter && !nameMatches(item.name, nameFilter)) return false
      // What the List's own columns print: a range band, the action type, a damage.
      if (rangeFilter || actionFilter || weaponsOnly) {
        const model = toEntityModel(item)
        if (rangeFilter && !entityRanges(model).includes(rangeFilter)) return false
        if (actionFilter && entityAction(model) !== actionFilter) return false
        if (weaponsOnly && !dealsDamage(model)) return false
      }
      return true
    })
  }, [
    initialData,
    techLevelFilters,
    sourceFilter,
    treeFilter,
    traitFilter,
    rangeFilter,
    actionFilter,
    weaponsOnly,
    nameFilter,
  ])

  // The Catalog is one flat grid, no group headings (a tree listing's by
  // name), but for the classes' Core and Hybrid headings, and the List is the
  // same entities a line each; the Tree groups.
  const flat = view !== 'tree'
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

  const hasActiveFilters =
    techLevelFilters.size > 0 ||
    weaponsOnly ||
    [sourceFilter, treeFilter, traitFilter, rangeFilter, actionFilter, nameFilter].some(
      (filter) => filter !== ''
    )
  // A choice from a menu (or Weapons only) folds a phone's open panel, so the
  // list it changed is in view (r5 E8); the Tech Levels are picked several at
  // a time, so the panel stays open for them. Wider, the facets never fold.
  const choosing =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value)
      setFacetsOpen(false)
    }
  const railActions: RailActions = {
    setName: filters.setName,
    toggleTechLevel,
    clearTechLevels: filters.clearTechLevels,
    setSource: choosing(filters.setSource),
    setTree: choosing(filters.setTree),
    setTrait: choosing(filters.setTrait),
    setRange: choosing(filters.setRange),
    setAction: choosing(filters.setAction),
    setWeapons: choosing(filters.setWeapons),
    setView,
    toggleFacets: () => setFacetsOpen((open) => !open),
    focusResults: () => focusFirstResult(),
  }

  const renderRail = (part: RailPart) => (
    <ListingRail
      part={part}
      facets={{
        count: initialData.length,
        shown: filteredData.length,
        techLevels: orderedTechLevels,
        sources,
        trees,
        traits,
        fields,
        views,
      }}
      filters={{
        techLevels: techLevelFilters,
        source: sourceFilter,
        tree: treeFilter,
        trait: traitFilter,
        range: rangeFilter,
        action: actionFilter,
        weapons: weaponsOnly,
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
          <ListingFilterStatus
            shown={filteredData.length}
            total={initialData.length}
            techLevels={orderedTechLevels}
            filters={filters}
          />
        )
      }
    />
  )

  return (
    <ListingFrame band={band} view={renderRail('view')} filters={renderRail('filters')}>
      <div
        className="su-listing"
        data-catalog={(view === 'catalog' && !hasArt) || undefined}
        data-view={view}
      >
        {!band && renderRail('all')}
        {/* From the filters straight to what they found (RR6-14). */}
        {initialData.length > TOOLBAR_MIN_ENTRIES && filteredData.length > 0 && (
          <a href={`#${RESULTS_ID}`} className="su-listing__skip">
            {islandsCopy('skipToResults')}
          </a>
        )}

        {hasActiveFilters && (
          <ListingPrinted
            levels={orderedTechLevels.filter((tl) => techLevelFilters.has(String(tl)))}
            words={[
              sourceFilter,
              treeFilter,
              traitFilter,
              rangeFilter,
              actionFilter,
              weaponsOnly ? islandsCopy('weaponsOnly') : '',
              nameFilter && `“${nameFilter}”`,
            ]}
            count={filteredData.length}
            total={initialData.length}
          />
        )}

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
            <div className="su-listing__groups" id={RESULTS_ID} tabIndex={-1}>
              {groups.map((group, groupIndex) => (
                <section key={group.key} className="su-listing__group" aria-label={group.label}>
                  {group.label && view !== 'list' && (
                    // A heading to jump between (WCAG 2.4.6); a tree says whose it is.
                    <Slab
                      as="h2"
                      label={group.label}
                      count={treeTracks.has(group.key) ? treeOwner(group.key) : undefined}
                    />
                  )}
                  {view === 'catalog' ? (
                    <ul className="su-listing__tiles">
                      {/* The address's sort is the List's; the tiles keep it (r2 H3). */}
                      {sortIndexItems(schemaId, group.items, filters.sort).map(
                        (item: RefEntity, index) => (
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
                              artUrl={artUrlFor(item)}
                            />
                          </li>
                        )
                      )}
                    </ul>
                  ) : view === 'list' ? (
                    // The List is one Ledger (ledger.md L1), a line an
                    // entity; a group's name (Core Classes) is its title tab.
                    <IndexLedger
                      schemaId={schemaId}
                      noun={group.label || band?.title || ''}
                      plain={!group.label || group.label === band?.title}
                      items={group.items}
                      order={{
                        sort: filters.sort,
                        sortBy: filters.sortBy,
                        clear: filters.clearSort,
                      }}
                      phone={{ columns: filters.columns, setColumns: filters.setColumns }}
                      orderNote={groupIndex === 0}
                      byName={byName}
                    />
                  ) : treeTracks.get(group.key) ? (
                    <ReferenceAbilityTrack
                      abilities={group.items as RefAbility[]}
                      track={treeTracks.get(group.key) ?? 'core'}
                    />
                  ) : (
                    <ul className="su-listing__cards">
                      {group.items.map((item: RefEntity) => (
                        <li key={item.id}>
                          {/* A tree with no track: one card, one click
                              (ruleset §1, E2, E11), a Compact in link mode. */}
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

/** A key per placeholder: a static run, never reordered. */
const placeholders = (count: number) => Array.from({ length: count }, (_, i) => `placeholder-${i}`)

/**
 * The listing while its schema loads: the rail as its inert placeholder, then
 * a placeholder per entity in the view's shape (the List's lines in their
 * frame, the Catalog's tiles, a Tree's cards) — the server render's layout, so
 * neither the gate opening nor the mount before it moves the listing.
 */
function ListingSkeleton({
  band,
  techLevels,
  sources,
  trees = [],
  traits = [],
  fields,
  hasArt,
  shape,
  view,
  views,
}: Omit<SchemaViewerIslandProps, 'preloadSchemas' | 'schemaId' | 'entryIds'> & {
  view: ListingView
  views: readonly ListingView[]
}) {
  const catalog = view === 'catalog'
  // The shape is the List's groups, the Catalog's too (one run, but for the
  // classes' headings); a Tree's groups are not known until its schema loads.
  const groups =
    shape && view !== 'tree'
      ? shape.groups
      : [{ key: 'all', label: undefined, count: shape?.count ?? 12 }]
  const renderRail = (part: RailPart) =>
    shape && (
      <ListingRail
        part={part}
        facets={{
          count: shape.count,
          techLevels: orderTechLevels(techLevels),
          sources,
          trees,
          traits,
          fields,
          views,
        }}
        view={view}
      />
    )
  return (
    <ListingFrame band={band} view={renderRail('view')} filters={renderRail('filters')}>
      <div
        className="su-listing"
        data-catalog={(catalog && !hasArt) || undefined}
        data-view={view}
        aria-hidden="true"
      >
        {!band && renderRail('all')}
        <div className="su-listing__groups">
          {groups.map((group) => (
            <section key={group.key} className="su-listing__group">
              {group.label && catalog && <Slab label={group.label} />}
              {catalog ? (
                <ul className="su-listing__tiles">
                  {placeholders(group.count).map((key) => (
                    <li key={key} className="su-listing__tile-skeleton" />
                  ))}
                </ul>
              ) : view === 'list' ? (
                // The Ledger's frame and its lines, a line an entity.
                <ul className="su-listing__lines">
                  {placeholders(group.count).map((key) => (
                    <li key={key} />
                  ))}
                </ul>
              ) : (
                <ul className="su-listing__cards">
                  {placeholders(group.count).map((key) => (
                    <li key={key}>
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

/** The island as Astro hydrates it: swapped in over `SchemaViewerListing` once its schemas are in (`clientSwap`). */
export const SchemaViewerIslandClient = clientSwap('SchemaViewerIsland', SchemaViewerIsland, {
  prepare: prepareSchemaViewerIsland,
})
