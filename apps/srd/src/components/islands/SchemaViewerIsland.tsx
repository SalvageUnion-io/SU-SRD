import {
  Button,
  EmptyState,
  EntitySurfaceProvider,
  SearchField,
  Select,
  Skeleton,
  Slab,
} from 'component-lib'
import { useEffect, useMemo, useState } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { getEntitySlug, getModel, getSource, getTechLevel, getTree } from 'salvageunion-reference'
import { itemHref, srdHrefFor } from '../../lib/entityHref'
import type { SchemaList } from '../../lib/useGameData'
import { GameDataGate } from '../../lib/useGameData'
import { EntityListingRow } from './EntityListingRow'
import { IslandErrorBoundary } from './IslandErrorBoundary'

// URL query-param keys the filter state is synced to, so a filtered view is
// bookmarkable/shareable and survives back-navigation.
const PARAM_TECH_LEVEL = 'tl'
const PARAM_SOURCE = 'source'
const PARAM_TREE = 'tree'
const PARAM_NAME = 'q'
/**
 * The retired catalog view's parameter (entity display language, E2: listing
 * Rows carry the art and the lore). An old `?view=catalog` link shows the list,
 * and the island drops the parameter from the URL.
 */
const PARAM_RETIRED_VIEW = 'view'

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

type TechLevel = number | 'B' | 'N'

/** The book's tech-level order: TL1–6, then Bio-tech and Nanite. */
const TL_ORDER: readonly TechLevel[] = [1, 2, 3, 4, 5, 6, 'B', 'N']

/** A tech level as the rail's toggle prints it: the numeral, or the word. */
function tlButtonLabel(level: TechLevel): string {
  return level === 'B' ? 'Bio' : level === 'N' ? 'Nanite' : String(level)
}

/** A tech level as a group heading and a filter token say it. */
function tlName(level: TechLevel): string {
  return level === 'B' ? 'Bio-tech' : level === 'N' ? 'Nanite' : `Tech Level ${level}`
}

/** The source as the menu prints it: the core rulebook's series prefix is noise there. */
function shortSource(source: string): string {
  return source.replace(/^Salvage Union /, '')
}

/** A listing's groups, in the order the book prints them. */
type ListingGroup = { key: string; label: string | undefined; items: SURefEntity[] }

/**
 * How a listing groups its entities, by data shape: abilities by tree, gear and
 * chassis by tech level, classes into base and hybrid. The group heading then
 * says what each card would otherwise repeat (the tree on its seam, its TL cell).
 */
type GroupBy = 'tree' | 'tl' | 'kind' | 'none'

function resolveGroupBy(items: SURefEntity[], trees: string[], techLevels: TechLevel[]): GroupBy {
  if (trees.length > 1) return 'tree'
  if (techLevels.length > 1 && items.every((item) => getTechLevel(item) != null)) return 'tl'
  if (items.length > 0 && items.every((item) => 'hybrid' in item)) return 'kind'
  return 'none'
}

function groupEntities(items: SURefEntity[], groupBy: GroupBy): ListingGroup[] {
  if (groupBy === 'none') return [{ key: 'all', label: undefined, items }]
  const byKey = new Map<string, ListingGroup>()
  for (const item of items) {
    const tl = getTechLevel(item)
    const tree = getTree(item)
    const hybrid = 'hybrid' in item && item.hybrid === true
    const key =
      groupBy === 'tree'
        ? String(tree ?? '')
        : groupBy === 'tl'
          ? String(tl ?? '')
          : hybrid
            ? 'hybrid'
            : 'base'
    const label =
      groupBy === 'tree'
        ? `${String(tree ?? '')} Tree`
        : groupBy === 'tl'
          ? tl != null
            ? tlName(tl)
            : ''
          : hybrid
            ? 'Hybrid Classes'
            : 'Base Classes'
    const group = byKey.get(key) ?? { key, label, items: [] }
    group.items.push(item)
    byKey.set(key, group)
  }
  const groups = [...byKey.values()]
  if (groupBy === 'tl') {
    const rank = (key: string) => TL_ORDER.findIndex((tl) => String(tl) === key)
    groups.sort((a, b) => rank(a.key) - rank(b.key))
  }
  if (groupBy === 'kind') groups.sort((a) => (a.key === 'base' ? -1 : 1))
  return groups
}

/**
 * Listings whose cards carry a long row of value cells take a wider column, so
 * the cells hold one line beside the art (two across at the page's measure).
 */
const WIDE_LISTINGS: ReadonlySet<string> = new Set(['chassis'])

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
}

/**
 * The listing's entities are not a prop: inlined into the page they were up to
 * 162 KB of JSON per listing. The schema is already in `preloadSchemas` (see
 * `getSchemaPreloadList`), so the grid reads it from the ORM once the gate
 * opens — the same `getModel(id).all()` the page builds from.
 */
export function SchemaViewerIsland({ preloadSchemas, ...props }: SchemaViewerIslandProps) {
  return (
    <IslandErrorBoundary>
      <GameDataGate
        schemas={preloadSchemas}
        fallback={
          <div className="srd-listing">
            <ul className="srd-listing__cards" data-entity-grid="">
              {Array.from({ length: 9 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static 9-item skeleton placeholder list, never reordered — index is stable
                <li key={i}>
                  <Skeleton mode="card" compact />
                </li>
              ))}
            </ul>
          </div>
        }
      >
        <SchemaViewer {...props} />
      </GameDataGate>
    </IslandErrorBoundary>
  )
}

/** Rendered only behind the gate: `getModel(…).all()` throws on an unloaded schema. */
function SchemaViewer({
  schemaId,
  techLevels,
  sources,
  trees = [],
}: Omit<SchemaViewerIslandProps, 'preloadSchemas'>) {
  const initialData = useMemo(() => getModel(schemaId)?.all() ?? [], [schemaId])

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
    params.delete(PARAM_RETIRED_VIEW)
    const qs = params.toString()
    const nextUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    const currentUrl = `${window.location.pathname}${window.location.search}`
    if (nextUrl !== currentUrl) {
      window.history.replaceState(window.history.state, '', nextUrl)
    }
  }, [techLevelFilters, sourceFilter, treeFilter, nameFilter])

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

  const orderedTechLevels = useMemo(
    () => TL_ORDER.filter((tl) => techLevels.some((level) => String(level) === String(tl))),
    [techLevels]
  )
  const groupBy = resolveGroupBy(initialData, trees, orderedTechLevels)
  const groups = useMemo(() => groupEntities(filteredData, groupBy), [filteredData, groupBy])
  // A single-kind listing: no seam stamp, and no TL cell when the tech level heads the group.
  const omit = useMemo(() => (groupBy === 'tl' ? ['kind', 'tech-level'] : ['kind']), [groupBy])

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

  const hasTechLevels = orderedTechLevels.length > 1
  const hasSources = sources.length > 1
  const hasTrees = trees.length > 1
  const hasFacets = hasTechLevels || hasSources || hasTrees
  // Show the name input whenever the dataset is large enough to benefit from it
  const hasNameFilter = initialData.length > 12

  const activeFacets = techLevelFilters.size + (sourceFilter ? 1 : 0) + (treeFilter ? 1 : 0)
  const hasActiveFilters = activeFacets > 0 || nameFilter !== ''
  const clearFilters = () => {
    setTechLevelFilters(new Set())
    setSourceFilter('')
    setTreeFilter('')
    setNameFilter('')
  }

  return (
    <div className="srd-listing" data-wide={WIDE_LISTINGS.has(schemaId) || undefined}>
      {/* THE RAIL — one row of 44px controls: search, the TL badge, the menus.
          On a phone the facets fold behind Filters. */}
      <div className="srd-rail" data-open={facetsOpen || undefined}>
        {hasNameFilter && (
          <SearchField
            type="search"
            name="name-filter"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            placeholder={`Filter ${initialData.length} by name`}
            aria-label="Filter items by name"
            containerClassName="srd-rail__search"
            glyphSize={18}
          />
        )}
        {hasFacets && (
          <button
            type="button"
            className="srd-rail__filters su-focus-ring"
            aria-expanded={facetsOpen}
            aria-controls="srd-rail-facets"
            onClick={() => setFacetsOpen((open) => !open)}
          >
            Filters
            {activeFacets > 0 && <span className="srd-rail__count">{activeFacets}</span>}
          </button>
        )}
        <span className="srd-rail__spring" />
        {hasFacets && (
          <div className="srd-rail__facets" id="srd-rail-facets">
            {hasTechLevels && (
              <fieldset className="srd-seg srd-seg--tl">
                <legend className="srd-vh">Tech Level</legend>
                <span className="srd-seg__stamp" aria-hidden="true">
                  TL
                </span>
                <button
                  type="button"
                  className="srd-seg__option su-focus-ring"
                  aria-pressed={techLevelFilters.size === 0}
                  onClick={() => setTechLevelFilters(new Set())}
                >
                  All
                </button>
                {orderedTechLevels.map((level) => (
                  <button
                    key={String(level)}
                    type="button"
                    className="srd-seg__option su-focus-ring"
                    data-numeral={typeof level === 'number' || undefined}
                    aria-pressed={techLevelFilters.has(String(level))}
                    aria-label={tlName(level)}
                    onClick={() => toggleTechLevel(level)}
                  >
                    {tlButtonLabel(level)}
                  </button>
                ))}
              </fieldset>
            )}
            {hasSources && (
              <Select
                chevron
                aria-label="Source"
                className="srd-rail__menu"
                data-on={sourceFilter ? true : undefined}
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
              >
                <option value="">All sources</option>
                {sources.map((source) => (
                  <option key={source} value={source}>
                    {shortSource(source)}
                  </option>
                ))}
              </Select>
            )}
            {hasTrees && (
              <Select
                chevron
                aria-label="Tree"
                className="srd-rail__menu"
                data-on={treeFilter ? true : undefined}
                value={treeFilter}
                onChange={(e) => setTreeFilter(e.target.value)}
              >
                <option value="">All {trees.length} trees</option>
                {trees.map((tree) => (
                  <option key={tree} value={tree}>
                    {tree}
                  </option>
                ))}
              </Select>
            )}
          </div>
        )}
      </div>

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
          <div className="srd-listing__groups">
            {groups.map((group) => (
              <section key={group.key} className="srd-listing__group" aria-label={group.label}>
                {group.label && (
                  <Slab variant="solid" label={group.label} count={group.items.length} />
                )}
                <ul className="srd-listing__cards" data-entity-grid="">
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
              </section>
            ))}
          </div>
        </EntitySurfaceProvider>
      )}
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
