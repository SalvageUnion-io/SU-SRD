import { SearchField, Select } from 'component-lib'
import type { TechLevel } from '../../lib/listingGroups'
import { tlName } from '../../lib/listingGroups'
import type { ListingView } from '../../lib/listingView'

/** A tech level as the rail's toggle prints it: the numeral, or the word. */
export function tlButtonLabel(level: TechLevel): string {
  return level === 'B' ? 'Bio' : level === 'N' ? 'Nanite' : String(level)
}

/** The source as the menu prints it: the core rulebook's series prefix is noise there. */
export function shortSource(source: string): string {
  return source.replace(/^Salvage Union /, '')
}

/** What the rail offers, from build-time data: it decides which controls it has. */
export type RailFacets = {
  /** The listing's size: the name filter shows above 12. */
  count: number
  /** In the book's order (`orderTechLevels`). */
  techLevels: TechLevel[]
  sources: string[]
  trees: string[]
  /** Only a schema with art has List | Catalog. */
  hasArt: boolean
}

export type RailFilters = {
  techLevels: ReadonlySet<string>
  source: string
  tree: string
  name: string
}

export const NO_FILTERS: RailFilters = { techLevels: new Set(), source: '', tree: '', name: '' }

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
   * same size, `inert` — what the server render and the island's skeleton set
   * above the grid, so the grid does not drop when the island's rail arrives.
   */
  actions?: RailActions
}

/**
 * THE RAIL — one row of 44px controls: search, the TL badge, the menus, then
 * List | Catalog where the schema has art. On a phone the facets fold behind
 * Filters.
 */
export function ListingRail({
  facets: { count, techLevels, sources, trees, hasArt },
  filters = NO_FILTERS,
  facetsOpen = false,
  view,
  actions,
}: ListingRailProps) {
  const on = actions ?? IDLE
  const hasTechLevels = techLevels.length > 1
  const hasSources = sources.length > 1
  const hasTrees = trees.length > 1
  const hasFacets = hasTechLevels || hasSources || hasTrees
  // Show the name input whenever the dataset is large enough to benefit from it
  const hasNameFilter = count > 12
  const activeFacets = filters.techLevels.size + (filters.source ? 1 : 0) + (filters.tree ? 1 : 0)

  return (
    <div className="srd-rail" data-open={facetsOpen || undefined} inert={!actions || undefined}>
      {hasNameFilter && (
        <SearchField
          type="search"
          name="name-filter"
          value={filters.name}
          onChange={(e) => on.setName(e.target.value)}
          placeholder={`Filter ${count} by name`}
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
          onClick={on.toggleFacets}
        >
          Filters
          {activeFacets > 0 && <span className="srd-rail__count">{activeFacets}</span>}
        </button>
      )}
      <span className="srd-rail__spring" />
      {hasArt && (
        <fieldset className="srd-seg srd-rail__view">
          <legend className="srd-vh">View</legend>
          {(['list', 'catalog'] as const satisfies readonly ListingView[]).map((option) => (
            <button
              key={option}
              type="button"
              className="srd-seg__option su-focus-ring"
              aria-pressed={view === option}
              onClick={() => on.setView(option)}
            >
              {option === 'list' ? 'List' : 'Catalog'}
            </button>
          ))}
        </fieldset>
      )}
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
                aria-pressed={filters.techLevels.size === 0}
                onClick={on.clearTechLevels}
              >
                All
              </button>
              {techLevels.map((level) => (
                <button
                  key={String(level)}
                  type="button"
                  className="srd-seg__option su-focus-ring"
                  data-numeral={typeof level === 'number' || undefined}
                  aria-pressed={filters.techLevels.has(String(level))}
                  aria-label={tlName(level)}
                  onClick={() => on.toggleTechLevel(level)}
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
              className="srd-rail__menu"
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
