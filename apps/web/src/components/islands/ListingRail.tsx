import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import type { ListingFieldFacets } from '../../lib/listingFacets'
import type { TechLevel } from '../../lib/listingGroups'
import { tlName } from '../../lib/listingGroups'
import type { ListingView } from '../../lib/listingView'
import { islandsCopy } from '../../messages/components-islands'
import { capsLabel } from '../atoms/capsLabel'
import { Badge, Button, SearchField, Segmented, SegmentedOption, Select, Toggle } from '../index'

/** The rail's menu is a caps label that keeps its rule's face and tracking. */
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
 * What a filtered list is filtered to, in words, on paper only (r4 E9,
 * `.su-listing__printed`): there the rail that says it on screen is not drawn.
 */
export function ListingPrinted({
  levels,
  words,
  count,
  total,
}: {
  levels: readonly TechLevel[]
  /** The other filters as set; an unset one is empty. */
  words: readonly string[]
  count: number
  total: number
}) {
  const filters = [...levels.map(tlName), ...words.filter(Boolean).map(shortSource)].join(' · ')
  return (
    <p className="su-listing__printed">
      {islandsCopy('filteredTo', { filters, count, count2: total })}
    </p>
  )
}

/**
 * The toolbar's cut-off: a listing shows its filter toolbar — the name filter
 * and its facets (tech level, sources, trees) — only when it lists more than
 * this many entries; a shorter one reads at a glance.
 */
export const TOOLBAR_MIN_ENTRIES = 12

/** The listing's results, which Skip to results and Enter in the name filter reach. */
export const RESULTS_ID = 'srd-listing-results'

/** Focus the first result's link, else the results themselves (RR6-14). */
export function focusFirstResult(): void {
  const results = document.getElementById(RESULTS_ID)
  ;(results?.querySelector<HTMLElement>('a[href]') ?? results)?.focus()
}

/** What the rail offers, from build-time data: it decides which controls it has. */
type RailFacets = {
  /** The listing's size: the toolbar shows above `TOOLBAR_MIN_ENTRIES`. */
  count: number
  /** How many the other filters leave: what the name filter would search (RR6-17). */
  shown?: number
  /** In the book's order (`orderTechLevels`). */
  techLevels: TechLevel[]
  sources: string[]
  trees: string[]
  /** The traits a weapon or a piece of gear can be filtered by (`listingTraits`); none on most listings. */
  traits?: string[]
  /** Range, Action and Weapons only, from the List's own columns (`listingFieldFacets`); Systems alone. */
  fields?: ListingFieldFacets
  /** The views it offers (`listingViews`): Catalog | List, a tree listing's Catalog | Tree | List. */
  views: readonly ListingView[]
}

type RailFilters = {
  techLevels: ReadonlySet<string>
  source: string
  tree: string
  trait?: string
  range?: string
  action?: string
  weapons?: boolean
  name: string
}

const VIEW_LABELS: Record<ListingView, string> = {
  catalog: 'Catalog',
  tree: 'Tree',
  list: 'List',
}

const NO_FILTERS: RailFilters = { techLevels: new Set(), source: '', tree: '', name: '' }

export type RailActions = {
  setName: (name: string) => void
  toggleTechLevel: (level: TechLevel) => void
  clearTechLevels: () => void
  setSource: (source: string) => void
  setTree: (tree: string) => void
  setTrait: (trait: string) => void
  setRange: (range: string) => void
  setAction: (action: string) => void
  setWeapons: (only: boolean) => void
  setView: (view: ListingView) => void
  toggleFacets: () => void
  /** Enter in the name filter: focus moves to the first result (RR6-14). */
  focusResults: () => void
}

const IDLE: RailActions = {
  setName: noop,
  toggleTechLevel: noop,
  clearTechLevels: noop,
  setSource: noop,
  setTree: noop,
  setTrait: noop,
  setRange: noop,
  setAction: noop,
  setWeapons: noop,
  setView: noop,
  toggleFacets: noop,
  focusResults: noop,
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
   * What is filtered (a token per filter, Clear all), after the count on the
   * status line: the rail's last line, drawn whenever it has a toolbar,
   * filtered or not, so a filter never moves a control (chrome K17).
   */
  status?: ReactNode
  /**
   * Which of the rail this draws (ledger L10): `view`, the List | Catalog
   * toggle alone, the one control a listing's chapter band holds; `filters`,
   * the rest (search, facets, what is filtered), the bar at the top of the
   * list; `all` (a listing with no band), both on one rail.
   */
  part?: 'all' | 'view' | 'filters'
}

/**
 * THE RAIL — one row of 44px controls: search, what is filtered, the TL badge,
 * the menus, then Catalog | Tree on the abilities. On a phone the facets fold
 * behind Filters.
 */
export function ListingRail({
  facets: { count, shown = count, techLevels, sources, trees, traits = [], fields, views },
  filters = NO_FILTERS,
  facetsOpen = false,
  view,
  actions,
  awaitsIsland = false,
  status,
  part = 'all',
}: ListingRailProps) {
  const on = actions ?? IDLE
  // One count rule: the toolbar (the name filter and every facet the listing
  // has) shows only above TOOLBAR_MIN_ENTRIES, and then all of it.
  const hasToolbar = count > TOOLBAR_MIN_ENTRIES
  const hasTechLevels = hasToolbar && techLevels.length > 1
  const hasSources = hasToolbar && sources.length > 1
  const hasTrees = hasToolbar && trees.length > 1
  const hasTraits = hasToolbar && traits.length > 1
  const hasRanges = hasToolbar && (fields?.ranges.length ?? 0) > 1
  const hasActions = hasToolbar && (fields?.actions.length ?? 0) > 1
  const hasWeapons = hasToolbar && fields?.weapons === true
  const hasFacets =
    hasTechLevels || hasSources || hasTrees || hasTraits || hasRanges || hasActions || hasWeapons
  const hasNameFilter = hasToolbar
  const showView = part !== 'filters' && views.length > 1
  const showFilters = part !== 'view'
  if (part === 'view' && !showView) return null
  if (part === 'filters' && !hasNameFilter && !hasFacets && !status) return null
  const hasStatus = showFilters && (hasToolbar || Boolean(status))
  // The name filter folds behind Filters on a phone (r8 G4): it counts there too.
  const activeFacets =
    (filters.name ? 1 : 0) +
    filters.techLevels.size +
    (filters.source ? 1 : 0) +
    (filters.tree ? 1 : 0) +
    (filters.trait ? 1 : 0) +
    (filters.range ? 1 : 0) +
    (filters.action ? 1 : 0) +
    (filters.weapons ? 1 : 0)

  return (
    <div
      className="su-rail"
      data-part={part === 'all' ? undefined : part}
      data-open={facetsOpen || undefined}
      inert={(!actions && !awaitsIsland) || undefined}
    >
      {showFilters && hasNameFilter && (
        <SearchField
          type="search"
          name="name-filter"
          value={filters.name}
          onChange={(e) => on.setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
            e.preventDefault()
            on.focusResults()
          }}
          // The count is what is shown: the other filters' leavings (RR6-17).
          placeholder={islandsCopy('filterByName', { count: shown })}
          aria-label={islandsCopy('filterItemsByName')}
          containerClassName="su-rail__search"
          glyph="full"
        />
      )}
      {showFilters && hasFacets && (
        <Button
          size="full"
          className="su-rail__filters"
          aria-expanded={facetsOpen}
          aria-controls="srd-rail-facets"
          onClick={on.toggleFacets}
        >
          {islandsCopy('filters')}
          {activeFacets > 0 && (
            <>
              {' '}
              <Badge shape="chip">{activeFacets}</Badge>
              <span className="su-sr-only"> {islandsCopy('active')}</span>
            </>
          )}
        </Button>
      )}
      {part === 'all' && <span className="su-rail__spring" />}
      {showView && (
        <Segmented label={islandsCopy('view')} className="su-rail__view">
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
      {showFilters && hasFacets && (
        <div className="su-rail__facets" id="srd-rail-facets">
          {hasTechLevels && (
            <Segmented label={islandsCopy('techLevel')} wrap>
              <span className="su-rail__stamp" aria-hidden="true">
                {islandsCopy('tl')}
              </span>
              <SegmentedOption pressed={filters.techLevels.size === 0} onClick={on.clearTechLevels}>
                {islandsCopy('all')}
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
              aria-label={islandsCopy('source')}
              className={MENU}
              data-on={filters.source ? true : undefined}
              value={filters.source}
              onChange={(e) => on.setSource(e.target.value)}
            >
              <option value="">{islandsCopy('allSources')}</option>
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
              aria-label={islandsCopy('tree')}
              className={MENU}
              data-on={filters.tree ? true : undefined}
              value={filters.tree}
              onChange={(e) => on.setTree(e.target.value)}
            >
              <option value="">{islandsCopy('allTrees', { count: trees.length })}</option>
              {trees.map((tree) => (
                <option key={tree} value={tree}>
                  {tree}
                </option>
              ))}
            </Select>
          )}
          {hasTraits && (
            <Select
              chevron
              aria-label={islandsCopy('trait')}
              className={MENU}
              data-on={filters.trait ? true : undefined}
              value={filters.trait ?? ''}
              onChange={(e) => on.setTrait(e.target.value)}
            >
              <option value="">{islandsCopy('allTraits', { count: traits.length })}</option>
              {traits.map((trait) => (
                <option key={trait} value={trait}>
                  {trait}
                </option>
              ))}
            </Select>
          )}
          {hasRanges && (
            <Select
              chevron
              aria-label={islandsCopy('range')}
              className={MENU}
              data-on={filters.range ? true : undefined}
              value={filters.range ?? ''}
              onChange={(e) => on.setRange(e.target.value)}
            >
              <option value="">{islandsCopy('anyRange')}</option>
              {fields?.ranges.map((range) => (
                <option key={range} value={range}>
                  {range}
                </option>
              ))}
            </Select>
          )}
          {hasActions && (
            <Select
              chevron
              aria-label={islandsCopy('action')}
              className={MENU}
              data-on={filters.action ? true : undefined}
              value={filters.action ?? ''}
              onChange={(e) => on.setAction(e.target.value)}
            >
              <option value="">{islandsCopy('anyAction')}</option>
              {fields?.actions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </Select>
          )}
          {hasWeapons && (
            <Toggle
              size="full"
              pressed={filters.weapons === true}
              onClick={() => on.setWeapons(!filters.weapons)}
            >
              {islandsCopy('weaponsOnly')}
            </Toggle>
          )}
        </div>
      )}
      {hasStatus && (
        // The count at the far end of the controls' last line (r8 owner review):
        // it changes with every filter, and nothing stands after it to move.
        <output className="su-rail__tally" aria-live="polite">
          {islandsCopy('of', { count: shown, count2: count })}
        </output>
      )}
      {hasStatus && (
        // What is filtered: one line under every control, there filtered or
        // not, so a filter changes the list alone (K17).
        <div className="su-rail__status">{status}</div>
      )}
    </div>
  )
}
