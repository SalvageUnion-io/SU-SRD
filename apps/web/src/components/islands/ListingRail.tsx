import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import type { TechLevel } from '../../lib/listingGroups'
import { tlName } from '../../lib/listingGroups'
import type { ListingView } from '../../lib/listingView'
import { capsLabel } from '../atoms/capsLabel'
import { SearchField, Segmented, SegmentedOption, Select } from '../index'

/** The rail's controls are caps labels; the menu keeps its rule's face and tracking. */
const FILTERS = cn('su-rail__filters su-focus-ring', capsLabel())
const MENU = cn('su-rail__menu', capsLabel({ weight: 'inherit', tracking: 'inherit' }))

/** A tech level as the rail's toggle prints it: the numeral, or the word. */
export function tlButtonLabel(level: TechLevel): string {
  return level === 'B' ? 'Bio' : level === 'N' ? 'Nanite' : String(level)
}

/** The source as the menu prints it: the core rulebook's series prefix is noise there. */
export function shortSource(source: string): string {
  return source.replace(/^Salvage Union /, '')
}

/**
 * The toolbar's cut-off: a listing shows its filter toolbar — the name filter
 * and its facets (tech level, sources, trees) — only when it lists more than
 * this many entries; a shorter one reads at a glance.
 */
export const TOOLBAR_MIN_ENTRIES = 12

/** What the rail offers, from build-time data: it decides which controls it has. */
type RailFacets = {
  /** The listing's size: the toolbar shows above `TOOLBAR_MIN_ENTRIES`. */
  count: number
  /** In the book's order (`orderTechLevels`). */
  techLevels: TechLevel[]
  sources: string[]
  trees: string[]
  /** The views it offers (`listingViews`): a tree listing's Catalog | Tree. */
  views: readonly ListingView[]
}

type RailFilters = {
  techLevels: ReadonlySet<string>
  source: string
  tree: string
  name: string
}

const VIEW_LABELS: Record<ListingView, string> = { catalog: 'Catalog', tree: 'Tree' }

const NO_FILTERS: RailFilters = { techLevels: new Set(), source: '', tree: '', name: '' }

export type RailActions = {
  setName: (name: string) => void
  toggleTechLevel: (level: TechLevel) => void
  clearTechLevels: () => void
  setSource: (source: string) => void
  setTree: (tree: string) => void
  setView: (view: ListingView) => void
  toggleFacets: () => void
}

const IDLE: RailActions = {
  setName: noop,
  toggleTechLevel: noop,
  clearTechLevels: noop,
  setSource: noop,
  setTree: noop,
  setView: noop,
  toggleFacets: noop,
}

function noop() {
  // The placeholder rail answers nothing; the island's rail replaces it.
}

type ListingRailProps = {
  facets: RailFacets
  filters?: RailFilters
  facetsOpen?: boolean
  /** The pressed view; none while the viewport has yet to decide (the server render). */
  view?: ListingView
  /**
   * Without actions the rail is its own placeholder: the same controls, at the
   * same size, `inert` — what the island's skeleton sets
   * above the grid, so the grid does not drop when the island's rail arrives.
   */
  actions?: RailActions
  /**
   * The server render of a listing whose island mounts on the reader's first
   * reach (`interaction`): the controls take focus and presses, which wake the
   * island and are played back on its rail (`runtime/interaction.ts`), so
   * this rail is not `inert` although it has no actions of its own.
   */
  awaitsIsland?: boolean
  /**
   * What is filtered (the count, the tokens, Clear all): inline between the
   * search and the menus where it fits, its own line beneath on a phone.
   */
  status?: ReactNode
}

/**
 * THE RAIL — one row of 44px controls: search, what is filtered, the TL badge,
 * the menus, then Catalog | Tree on the abilities. On a phone the facets fold
 * behind Filters.
 */
export function ListingRail({
  facets: { count, techLevels, sources, trees, views },
  filters = NO_FILTERS,
  facetsOpen = false,
  view,
  actions,
  awaitsIsland = false,
  status,
}: ListingRailProps) {
  const on = actions ?? IDLE
  // One count rule: the toolbar (the name filter and every facet the listing
  // has) shows only above TOOLBAR_MIN_ENTRIES, and then all of it.
  const hasToolbar = count > TOOLBAR_MIN_ENTRIES
  const hasTechLevels = hasToolbar && techLevels.length > 1
  const hasSources = hasToolbar && sources.length > 1
  const hasTrees = hasToolbar && trees.length > 1
  const hasFacets = hasTechLevels || hasSources || hasTrees
  const hasNameFilter = hasToolbar
  const activeFacets = filters.techLevels.size + (filters.source ? 1 : 0) + (filters.tree ? 1 : 0)

  return (
    <div
      className="su-rail"
      data-open={facetsOpen || undefined}
      inert={(!actions && !awaitsIsland) || undefined}
    >
      {hasNameFilter && (
        <SearchField
          type="search"
          name="name-filter"
          value={filters.name}
          onChange={(e) => on.setName(e.target.value)}
          placeholder={`Filter ${count} by name`}
          aria-label="Filter items by name"
          containerClassName="su-rail__search"
          glyph="full"
        />
      )}
      {hasFacets && (
        <button
          type="button"
          className={FILTERS}
          aria-expanded={facetsOpen}
          aria-controls="srd-rail-facets"
          onClick={on.toggleFacets}
        >
          Filters
          {activeFacets > 0 && <span className="su-rail__count">{activeFacets}</span>}
        </button>
      )}
      {status}
      <span className="su-rail__spring" />
      {views.length > 1 && (
        <Segmented label="View" className="su-rail__view">
          {views.map((option) => (
            <SegmentedOption
              key={option}
              pressed={view === option}
              onClick={() => on.setView(option)}
            >
              {VIEW_LABELS[option]}
            </SegmentedOption>
          ))}
        </Segmented>
      )}
      {hasFacets && (
        <div className="su-rail__facets" id="srd-rail-facets">
          {hasTechLevels && (
            <Segmented label="Tech Level">
              <span className="su-rail__stamp" aria-hidden="true">
                TL
              </span>
              <SegmentedOption pressed={filters.techLevels.size === 0} onClick={on.clearTechLevels}>
                All
              </SegmentedOption>
              {techLevels.map((level) => (
                <SegmentedOption
                  key={String(level)}
                  numeral={typeof level === 'number'}
                  pressed={filters.techLevels.has(String(level))}
                  aria-label={tlName(level)}
                  onClick={() => on.toggleTechLevel(level)}
                >
                  {tlButtonLabel(level)}
                </SegmentedOption>
              ))}
            </Segmented>
          )}
          {hasSources && (
            <Select
              chevron
              aria-label="Source"
              className={MENU}
              data-on={filters.source ? true : undefined}
              value={filters.source}
              onChange={(e) => on.setSource(e.target.value)}
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
              className={MENU}
              data-on={filters.tree ? true : undefined}
              value={filters.tree}
              onChange={(e) => on.setTree(e.target.value)}
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
  )
}
