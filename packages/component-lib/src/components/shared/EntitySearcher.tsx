/**
 * EntitySearcher — the one shared "add an entity" body for every live-sheet
 * and standalone picker modal (pilot equipment/abilities, mech systems/modules,
 * crawler weapons, chassis/NPC pickers). Drops into `SheetPickerModal` in place
 * of the ad-hoc wizard steps; the creation wizard keeps its own capped
 * count-stepper flow.
 *
 * It generalizes the mech Install step (TL filter chips + masonry + a running
 * loadout rail) and adds the missing legibility the old equipment modal lacked:
 * a live text search, a Status facet, and an always-visible rail so "what's
 * already on the sheet" vs. "what I can still add" reads at a glance instead of
 * being inferred from a faint selection ring.
 *
 * Persistence-agnostic: the caller owns `selected` and the add/remove handlers
 * (ADR-010). One identity both ways: a card is selected when `selected` holds
 * its `idOf`, and adding it emits that same `idOf` (default the entity name).
 *
 * `mode="single"` covers the exactly-one swaps (chassis, crawler type, pilot
 * class), which used to be hand-rolled master/detail pairs: a narrow option
 * rail beside a preview pane. That shape does not survive a large entity —
 * a chassis card is wider than a 220px track, so every option rendered clipped —
 * so those pickers now run here too, with `hide` dropping the sections a picker
 * cannot act on and `railActions` carrying their confirm affordance.
 *
 * WHERE THE RAIL SITS. Never over the results. It used to float over the
 * bottom-right of the pool, where on a phone it covered a third of what you
 * were choosing from. Now (layout in the `.su-searcher*` classes in
 * styles/index.css):
 *   - below 80rem it is a sticky band ABOVE the pool — a disclosure that,
 *     collapsed (the default: the results are the task), still shows the count
 *     and the budget, and expands to the chosen heads with their Remove buttons;
 *   - from 80rem it is its own scrolling column RIGHT of the pool, always open;
 *   - `mode="single"` has one chosen entity and a confirm pair, so it is a
 *     one-line band at every width and keeps the pool at full width.
 * DOM order follows the visual order, so focus order does too.
 *
 * NOTHING BELOW A FOLD. The frame is capped at the dynamic viewport and its
 * body takes what the header leaves, scrolling in it — so on a phone the
 * results and the selection are always reachable. That only works if the
 * header itself is bounded, so below 80rem the sub-header is just the search
 * field and a Filters disclosure (open by default from 40rem, folded on a
 * phone); open, the facet rows scroll in their own capped panel. From 80rem the
 * facet rows sit inline, as they always did.
 */

import { ChevronDown } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type {
  EntitySchemaName,
  SchemaToEntityMap,
  SURefEnumSchemaName,
} from 'salvageunion-reference'
import { SalvageUnionReference, searchIn, techLevelRank } from 'salvageunion-reference'
import type { TechLevel } from 'salvageunion-reference/rules'
import { borderWidth, color, font, fontSize, radius, space, weight } from '../../design/tokens'
import { cn } from '../../utils/cn'
import { Badge } from '../chrome/Badge'
import { BandTitle } from '../chrome/BandTitle'
import { Button } from '../chrome/Button'
import { capsLabel } from '../chrome/capsLabel'
import { FOCUS_RING, FOCUS_WITHIN } from '../chrome/interaction'
import { PageHeading } from '../chrome/PageHeading'
import { ReferenceEntityCard } from '../referenceEntity/card/ReferenceEntityCard'
import type { ReferenceEntityCardHideConfig } from '../referenceEntity/card/referenceEntityCardTypes'
import { statBlockRowStarts } from '../stat/pipRows'
import { Card } from './Card'
import { FilterRow } from './FilterRow'
import { MasonryColumns } from './MasonryColumns'
import { Stat } from './Stat'

/** A tech level as the reference data carries it — schema-typed `number`, not
 * the rules module's 1–6 literal union, so ORM entities assign structurally. */
type TechLevelLike = number | 'B' | 'N'

/** The minimum shape the searcher reads off a reference entity. */
type EntityLike = {
  id: string
  name: string
  techLevel?: TechLevelLike
  traits?: Array<{ type: string; amount?: string | number }>
}

/** A pool row: the structural `EntityLike` view the searcher reads, WITHOUT
 * losing the reference-entity identity `ReferenceEntityCard` renders. */
type PoolEntity = EntityLike & SchemaToEntityMap[EntitySchemaName]

/** Which built-in facets to show, plus an optional schema-specific category. */
type FacetConfig = {
  /** Tech-level swatch chips. Default: auto (shown when the pool spans ≥2 TLs). */
  techLevel?: boolean
  /** All / Equipped only / Not yet equipped. Default: true. */
  status?: boolean
  /** Trait-type chips. Default: auto (shown when the pool has ≥2 trait types). */
  traits?: boolean
  /** A schema-specific categorical facet (e.g. ability `tree`, NPC `damageType`). */
  category?: { label: string; of: (item: EntityLike) => string | undefined }
}

type BudgetConfig = {
  label: string
  used: number
  max: number
  /** 'ap' renders rust pips (e.g. Energy); default ink. */
  tone?: 'default' | 'ap'
}

type EntitySearcherProps = {
  /** Which reference collection to search. */
  schema: EntitySchemaName
  /** Refs currently on the sheet (may contain duplicates in `count` mode). */
  selected: string[]
  /**
   * `toggle` (default): one copy per entity, clicking the card adds/removes it.
   * `count`: duplicates are legal — each card has an Add affordance, removal
   * happens per-entry in the rail.
   * `single`: exactly one — the pool is a `radiogroup` and each card announces
   * `aria-checked`. The emission contract is the same as `toggle` (the caller
   * replaces its selection rather than appending), so a single-select picker
   * differs only in a11y semantics, not in wiring.
   */
  mode?: 'toggle' | 'count' | 'single'
  /** toggle/single mode: add or remove (emits `idOf(item)` either way). */
  onToggle?: (ref: string) => void
  /** count mode: append one copy (emits `idOf(item)`). */
  onAdd?: (ref: string) => void
  /** count mode: remove the chosen entry at `index` in `selected`. */
  onRemove?: (index: number) => void
  /** A card's identity in `selected`, and what adding it emits. Default: the entity name. */
  idOf?: (item: EntityLike) => string
  /** Narrow the pool (e.g. only weapons). Default: the whole collection. */
  filter?: (item: EntityLike) => boolean
  facets?: FacetConfig
  /** Optional soft budget track(s) shown in the rail (never blocks selection). */
  budget?: BudgetConfig | BudgetConfig[]
  /** Rail header name, e.g. the pilot or mech name. */
  railName?: string
  /** Rail header noun for the chosen list, e.g. 'Equipped', 'Installed'. */
  chosenLabel?: string
  /** Copy shown when nothing matches the filters. */
  emptyMessage?: string
  /** The title rendered in the searcher's Card header. */
  title?: string
  /** A caveat stamped under the title, e.g. a destructive-change warning. The
   * searcher is usually launched in a `bare` ModalShell, which paints no header
   * of its own, so this is where a picker's warning copy lives. */
  subtitle?: string
  /** Close handler — renders the header's close badge. */
  onClose?: () => void
  /**
   * Extra `hide` config for the pool + rail cards, merged OVER the searcher's
   * own defaults (actions/choices are always suppressed). Big entities — a
   * chassis, a crawler type — carry sections a picker has no room for
   * (`{ patterns: true }`), and that is a property of the entity, not of the
   * surface, so it is the caller's call rather than a schema check in here.
   */
  hide?: ReferenceEntityCardHideConfig
  /**
   * Actions pinned beneath the selection — e.g. the Apply/Cancel pair a
   * destructive picker needs. Always visible: at the foot of the rail column,
   * or in the band (collapsed or not) on a narrow screen and in single mode.
   * It is the one place a confirm affordance can sit without a second band
   * competing with it.
   */
  railActions?: ReactNode
}

const ALL_TLS: TechLevel[] = [1, 2, 3, 4, 5, 6, 'B', 'N']

/** The default `idOf`: module-level, so it is one function across renders. */
const nameOf = (item: EntityLike) => item.name

function tlLabel(tl: TechLevelLike): string {
  return typeof tl === 'number' ? `TL${tl}` : tl === 'B' ? 'Bio' : 'Nanite'
}

function tlSwatch(tl: TechLevelLike): string {
  return `var(--color-tl-${typeof tl === 'number' ? tl : tl.toLowerCase()})`
}

export function EntitySearcher({
  schema,
  selected,
  mode = 'toggle',
  onToggle,
  onAdd,
  onRemove,
  idOf = nameOf,
  filter,
  facets,
  budget,
  railName,
  chosenLabel = 'Selected',
  emptyMessage = 'Nothing found.',
  title,
  subtitle,
  onClose,
  hide,
  railActions,
}: EntitySearcherProps) {
  // Actions/choices are never pickable inside a picker; anything else is the
  // caller's to suppress.
  const cardHide: ReferenceEntityCardHideConfig = { ...hide, actions: true, choices: true }
  const [query, setQuery] = useState('')
  const [activeTls, setActiveTls] = useState<Set<TechLevelLike>>(() => new Set())
  const [activeCats, setActiveCats] = useState<Set<string>>(() => new Set())
  const [activeTraits, setActiveTraits] = useState<Set<string>>(() => new Set())
  const [status, setStatus] = useState<'all' | 'equipped' | 'available'>('all')
  const wide = useWideLayout()
  // Narrow, the facet rows fold behind a Filters disclosure — and on a phone
  // they start folded: an ability picker's ~30 Tree chips alone outgrow it.
  const [filtersOpen, setFiltersOpen] = useState(
    () => typeof window === 'undefined' || window.matchMedia(ROOMY_QUERY).matches
  )
  const filtersId = useId()

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
  const showStatus = facets?.status !== false

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

  function toggleIn<T>(set: Set<T>, value: T, setter: (s: Set<T>) => void) {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    setter(next)
  }

  // ---- Sub-parts of the searcher Card ----
  const searchInput = (
    <label
      className={cn(
        'flex w-full items-center gap-2 rounded-card border-chrome border-ink bg-paper px-3 py-2',
        FOCUS_WITHIN
      )}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="opacity-70">
        <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
        <line x1="11" y1="11" x2="15" y2="15" stroke="currentColor" strokeWidth="2" />
      </svg>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or trait…"
        aria-label="Search"
        autoComplete="off"
        // `text-base`, not `text-sm`: iOS Safari zooms the viewport on a focused
        // control below 16px. See the note in `chrome/inputs.tsx`.
        className="w-full bg-transparent font-body text-base text-ink outline-none placeholder:text-wk-muted"
      />
    </label>
  )

  const summaryNode = (
    <span className="whitespace-nowrap font-cond text-label font-bold uppercase tracking-caps text-wk-muted">
      <span className="text-ink">{totalOnSheet}</span> on sheet · showing {visible.length} of{' '}
      {pool.length}
    </span>
  )

  // Facet rows as one config map, rendered through the shared FilterRow. The
  // "Show" row stays separate so the floating sub-header can space the search
  // field OPPOSITE it.
  type FacetRowConfig = {
    label: string
    chips: Array<{
      key: string
      label: string
      active: boolean
      onClick: () => void
      swatchStyle?: string
    }>
  }

  const facetRowConfigs: FacetRowConfig[] = []
  if (showTl)
    facetRowConfigs.push({
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
    facetRowConfigs.push({
      label: facets.category.label,
      chips: catOptions.map((c) => ({
        key: c,
        label: c,
        active: activeCats.has(c),
        onClick: () => toggleIn(activeCats, c, setActiveCats),
      })),
    })
  if (showTraits)
    facetRowConfigs.push({
      label: 'Traits',
      chips: traitOptions.map((t) => ({
        key: t,
        label: t,
        active: activeTraits.has(t),
        onClick: () => toggleIn(activeTraits, t, setActiveTraits),
      })),
    })
  const showRowConfig: FacetRowConfig | null = showStatus
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

  const renderFacetRow = (row: FacetRowConfig) => (
    <FilterRow key={row.label} label={row.label} onDark>
      {row.chips.map(({ key, label, active, onClick, swatchStyle }) => (
        <Badge
          key={key}
          shape="chip"
          as="button"
          aria-pressed={active}
          surface={active ? 'solid' : 'ghost'}
          swatch={swatchStyle}
          onClick={onClick}
        >
          {label}
        </Badge>
      ))}
    </FilterRow>
  )

  // Wide sub-header: the facet rows, with the search field on the final row
  // spaced OPPOSITE the "Show" facet.
  const floatingSubHeader = (
    <div className="flex w-full flex-col gap-2">
      {facetRowConfigs.map(renderFacetRow)}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {showRowConfig ? renderFacetRow(showRowConfig) : <span aria-hidden="true" />}
        <div className="w-full sm:w-[280px]">{searchInput}</div>
      </div>
    </div>
  )

  // Narrow sub-header: the search field always in reach, the facet rows
  // (Show included) behind a Filters disclosure whose panel scrolls on its own.
  // Both are bounded, so the header can never again be taller than the screen.
  const filterRows = showRowConfig ? [...facetRowConfigs, showRowConfig] : facetRowConfigs
  const activeFilters =
    (showTl ? activeTls.size : 0) +
    (showCat ? activeCats.size : 0) +
    (showTraits ? activeTraits.size : 0) +
    (showStatus && status !== 'all' ? 1 : 0)
  const narrowSubHeader = (
    <div style={NARROW_SUBHEADER_STYLE}>
      <div style={SEARCH_ROW_STYLE}>
        <div style={SEARCH_SLOT_STYLE}>{searchInput}</div>
        {filterRows.length > 0 && (
          <Button
            size="compact"
            aria-expanded={filtersOpen}
            aria-controls={filtersId}
            onClick={() => setFiltersOpen((v) => !v)}
            style={FILTERS_TOGGLE_STYLE}
          >
            Filters
            {activeFilters > 0 && (
              <>
                {' '}
                <Badge shape="chip" surface="solid">
                  {activeFilters}
                </Badge>
                <span style={VISUALLY_HIDDEN}> active</span>
              </>
            )}
            <ChevronDown aria-hidden="true" style={chevronStyle(filtersOpen)} />
          </Button>
        )}
      </div>
      {filterRows.length > 0 && (
        <div id={filtersId} hidden={!filtersOpen} style={FILTER_PANEL_STYLE}>
          <div style={FILTER_STACK_STYLE}>{filterRows.map(renderFacetRow)}</div>
        </div>
      )}
    </div>
  )

  const poolNode = (
    <div className="min-w-0">
      <MasonryColumns
        maxColumns={2}
        radio={mode === 'single'}
        ariaLabel={mode === 'single' ? (title ?? 'Options') : undefined}
      >
        {visible.map((item) => {
          const count = countOf(item)
          if (mode === 'count') {
            return (
              <CountCard
                key={item.id}
                entity={item}
                count={count}
                onAdd={() => onAdd?.(idOf(item))}
                hide={cardHide}
              />
            )
          }
          const isSelected = count > 0
          return (
            <ReferenceEntityCard
              key={item.id}
              data={item}
              size="medium"
              selected={isSelected}
              selectionRole={mode === 'single' ? 'radio' : 'toggle'}
              cardClickLabel={item.name}
              selectionSeal={chosenLabel}
              onCardClick={() => onToggle?.(idOf(item))}
              hide={cardHide}
            />
          )
        })}
      </MasonryColumns>
      {visible.length === 0 && (
        <p className="mt-3 font-body text-sm text-wk-muted">{emptyMessage}</p>
      )}
    </div>
  )

  const single = mode === 'single'
  const rail = single ? (
    <ChosenBar
      chosenLabel={chosenLabel}
      schema={schema}
      selected={selected}
      idOf={idOf}
      budget={budget}
      actions={railActions}
    />
  ) : (
    <SelectionRail
      wide={wide}
      name={railName}
      chosenLabel={chosenLabel}
      schema={schema}
      selected={selected}
      idOf={idOf}
      budget={budget}
      mode={mode === 'count' ? 'count' : 'toggle'}
      onToggle={onToggle}
      onRemove={onRemove}
      hide={cardHide}
      actions={railActions}
    />
  )
  // DOM order = visual order, so focus order follows the eye: a band ABOVE the
  // pool comes before it, a column to its RIGHT comes after it.
  const railFirst = single || !wide

  // A self-contained Card: title + close badge in the header, search + all
  // filters in the sub-header band, then the body — the pool and the selection
  // rail, laid out by the `.su-searcher` classes (see the header comment).
  return (
    <Card
      headerBg="bg-pilot"
      bodyPadding="p-0"
      headerContent={
        <div className="flex w-full items-center gap-3">
          {/* Column, so `fill` is off on both — `flex-1` inside a flex-col
              would grow the title vertically, not claim the band's width.
              The wrapper takes the track instead and the titles truncate. */}
          <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
            <BandTitle fill={false} className="max-w-full">
              {title}
            </BandTitle>
            {subtitle && (
              <BandTitle variant="mute" fill={false} className="max-w-full">
                {subtitle}
              </BandTitle>
            )}
          </div>
          {onClose && (
            <Button
              variant="default"
              size="iconOnly"
              onClick={onClose}
              aria-label="Close"
              className="rounded-badge font-cond font-bold"
            >
              ✕
            </Button>
          )}
        </div>
      }
      subHeader={wide ? floatingSubHeader : narrowSubHeader}
      cardStyle={{ style: FRAME_STYLE }}
      bodyStyle={BODY_STYLE}
    >
      <div className={cn('su-searcher', single && 'su-searcher--bar')}>
        {railFirst && rail}
        <div className="su-searcher__pool" style={POOL_STYLE}>
          <div style={SUMMARY_ROW_STYLE}>{summaryNode}</div>
          {poolNode}
        </div>
        {!railFirst && rail}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Layout state + static styles
// ---------------------------------------------------------------------------

/**
 * The width at which the rail stops being a band above the pool and becomes a
 * column beside it. Mirrors the `.su-searcher` media query in
 * styles/index.css — change both or neither. CSS owns the LAYOUT; this only
 * decides what the parts ARE at that width: the rail a disclosure or a plain
 * heading, the facets folded behind Filters or inline in the sub-header.
 */
const WIDE_QUERY = '(min-width: 80rem)'

/** Narrow but roomy — a tablet, either way up: the Filters disclosure starts
 * OPEN. A phone, in portrait (too narrow) or landscape (too short), starts it
 * folded. Only the initial state — not a layout breakpoint. */
const ROOMY_QUERY = '(min-width: 40rem) and (min-height: 40rem)'

function subscribeWide(onChange: () => void): () => void {
  const query = window.matchMedia(WIDE_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

const isWide = () => window.matchMedia(WIDE_QUERY).matches

/** The server snapshot is the band — the narrow default, like MasonryColumns'
 * one-column SSR snapshot — so a server render never commits to the column. */
function useWideLayout(): boolean {
  return useSyncExternalStore(subscribeWide, isWide, () => false)
}

/**
 * A polite live-region message that speaks only when `message` CHANGES — the
 * count the user just altered, never the one the picker opened with (a live
 * region's initial content is not news). The ref, not a mount flag, is what
 * keeps StrictMode's double-run effect from announcing on open.
 */
function useAnnouncement(message: string): string {
  const [spoken, setSpoken] = useState('')
  const last = useRef(message)
  useEffect(() => {
    if (last.current === message) return
    last.current = message
    setSpoken(message)
  }, [message])
  return spoken
}

// Static properties only — every property that changes with the breakpoint
// lives in the `.su-searcher*` classes (the split rule; see styles/index.css).

/**
 * The frame never exceeds the DYNAMIC viewport (less the bare popup's 2rem
 * margins and any safe-area inset), so its body — allowed to shrink by
 * `BODY_STYLE` — always gets the room left under the header, and scrolls in
 * it. `dvh`, not `vh`: on a phone `100vh` is the toolbar-hidden height, which
 * would put the frame's foot under the browser chrome. The bare popup's own cap
 * is `100vh - 4rem`, so this one is never the larger of the two.
 */
const FRAME_STYLE = {
  maxHeight:
    'calc(100dvh - 4rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
} satisfies CSSProperties
const BODY_STYLE = { minHeight: 0 } satisfies CSSProperties

const NARROW_SUBHEADER_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
  width: '100%',
} satisfies CSSProperties
const SEARCH_ROW_STYLE = {
  display: 'flex',
  alignItems: 'center',
  gap: space[8],
} satisfies CSSProperties
const SEARCH_SLOT_STYLE = { flex: '1 1 auto', minWidth: 0 } satisfies CSSProperties
const FILTERS_TOGGLE_STYLE = { flexShrink: 0 } satisfies CSSProperties
/** Open, the facet rows scroll inside their own panel rather than growing the
 * header, so open filters never take more than 40% of the screen. No `display`
 * here: the panel folds with the `hidden` attribute. */
const FILTER_PANEL_STYLE = { maxHeight: '40dvh', overflowY: 'auto' } satisfies CSSProperties
const FILTER_STACK_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
  paddingBottom: space[4],
} satisfies CSSProperties

/** `isolation` keeps a pool card's own stacking (a hovered card's z-10, a
 * seam stamp's z-30) inside the pool, so the sticky band always paints over it. */
const POOL_STYLE = { padding: space[16], isolation: 'isolate' } satisfies CSSProperties
const SUMMARY_ROW_STYLE = { marginBottom: space[12] } satisfies CSSProperties

const VISUALLY_HIDDEN = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  margin: '-1px',
  padding: space[0],
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  borderWidth: space[0],
} satisfies CSSProperties

const RAIL_STYLE = { backgroundColor: color.paper, color: color.ink } satisfies CSSProperties

/** Narrow: one wrapping row — the disclosure, then the at-a-glance budget. */
const RAIL_HEAD_BAND_STYLE = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  columnGap: space[16],
  rowGap: space[6],
  padding: `${space[10]} ${space[16]}`,
} satisfies CSSProperties

/** Wide: the heading over the full budget tracks, pinned above the list. */
const RAIL_HEAD_COLUMN_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[12],
  padding: `${space[16]} ${space[16]} ${space[12]}`,
} satisfies CSSProperties

/** The heading claims the band's free width, so the whole row is the target. */
const RAIL_HEADING_SLOT_STYLE = { flex: '1 1 12rem', minWidth: 0 } satisfies CSSProperties

const RAIL_TITLE_STYLE = {
  display: 'flex',
  alignItems: 'center',
  gap: space[8],
  minWidth: 0,
} satisfies CSSProperties

/** A bare button wearing its heading's type — `inherit` across the board,
 * because a button's UA style resets font, tracking and case. */
const RAIL_TOGGLE_STYLE = {
  ...RAIL_TITLE_STYLE,
  width: '100%',
  margin: space[0],
  padding: space[0],
  borderWidth: space[0],
  borderRadius: radius.card,
  background: 'none',
  color: 'inherit',
  font: 'inherit',
  letterSpacing: 'inherit',
  textTransform: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
} satisfies CSSProperties

const RAIL_NAME_STYLE = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: color.ink75,
} satisfies CSSProperties

function chevronStyle(open: boolean): CSSProperties {
  return {
    width: space[16],
    height: space[16],
    flexShrink: 0,
    marginLeft: 'auto',
    transition: 'transform 150ms',
    transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
  }
}

/** No `display` here: the list is folded with the `hidden` attribute. */
const RAIL_LIST_STYLE = {
  paddingLeft: space[16],
  paddingRight: space[16],
  paddingBottom: space[12],
} satisfies CSSProperties

const STACK_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
} satisfies CSSProperties
const BUDGET_STACK_STYLE = { ...STACK_STYLE, gap: space[12] } satisfies CSSProperties

const RAIL_ENTRY_STYLE = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: space[8],
} satisfies CSSProperties
const RAIL_ENTRY_BODY_STYLE = { flex: '1 1 0%', minWidth: 0 } satisfies CSSProperties
const COPY_STYLE = {
  display: 'block',
  marginTop: space[2],
  paddingLeft: space[4],
  paddingRight: space[4],
  color: color.wkMuted,
} satisfies CSSProperties
const REMOVE_STYLE = { marginTop: space[2], flexShrink: 0 } satisfies CSSProperties

const EMPTY_STYLE = {
  margin: space[0],
  fontFamily: font.body,
  fontSize: fontSize.xs,
  color: color.wkMuted,
} satisfies CSSProperties

const RAIL_ACTIONS_STYLE = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  gap: space[8],
  padding: `${space[10]} ${space[16]}`,
  borderTop: `${borderWidth.hairline} solid ${color.ink20}`,
} satisfies CSSProperties

const BUDGET_SUMMARY_STYLE = {
  display: 'flex',
  flexWrap: 'wrap',
  columnGap: space[12],
  rowGap: space[2],
  margin: space[0],
} satisfies CSSProperties

/** Single mode: label, the chosen name, any budget, the confirm pair — one row. */
const BAR_STYLE = {
  ...RAIL_STYLE,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  columnGap: space[12],
  rowGap: space[8],
  padding: `${space[10]} ${space[16]}`,
} satisfies CSSProperties
const BAR_CHOSEN_STYLE = {
  minWidth: 0,
  fontFamily: font.body,
  fontSize: fontSize.sm,
  fontWeight: weight.bold,
  overflowWrap: 'anywhere',
} satisfies CSSProperties
const BAR_ACTIONS_STYLE = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[8],
  marginLeft: 'auto',
} satisfies CSSProperties

// ---------------------------------------------------------------------------
// Count-mode card (duplicates legal — Add / Add another; remove in the rail)
// ---------------------------------------------------------------------------

function CountCard({
  entity,
  count,
  onAdd,
  hide,
}: {
  entity: PoolEntity
  count: number
  onAdd: () => void
  hide: ReferenceEntityCardHideConfig
}) {
  const installed = count > 0
  return (
    <div className={cn('rounded-panel', installed && 'shadow-[0_0_0_3px_var(--color-rust)]')}>
      <ReferenceEntityCard data={entity} size="medium" hide={hide} />
      <div className="mt-1.5 flex items-center gap-2 px-1">
        {installed && (
          <span className="font-cond text-badge font-bold uppercase tracking-caps text-ink">
            {count} Added
          </span>
        )}
        <Button size="mini" onClick={onAdd} aria-label={`Add ${entity.name}`}>
          {installed ? '+ Add another' : '+ Add'}
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Selection rail — what's on the sheet + soft budget, never over the results
// ---------------------------------------------------------------------------

type RailEntry = {
  entity: PoolEntity
  /** The stored ref, as the caller holds it (toggle mode removes by ref). */
  ref: string
  /** Position in `selected` (count mode removes by index). */
  index: number
  copy: number
  total: number
}

function budgetList(budget?: BudgetConfig | BudgetConfig[]): BudgetConfig[] {
  return budget ? (Array.isArray(budget) ? budget : [budget]) : []
}

/** `selected`, resolved by `idOf` against the whole collection (not the
 * filtered pool), with each duplicate numbered — "Copy 2 of 3". Unresolvable
 * refs drop out. */
function useRailEntries(
  schema: EntitySchemaName,
  selected: string[],
  idOf: (item: EntityLike) => string
): RailEntry[] {
  return useMemo(() => {
    const byId = new Map<string, PoolEntity>()
    for (const e of SalvageUnionReference.findAllIn(schema, () => true) as PoolEntity[]) {
      if (!byId.has(idOf(e))) byId.set(idOf(e), e)
    }
    const totals = new Map<string, number>()
    for (const ref of selected) totals.set(ref, (totals.get(ref) ?? 0) + 1)
    const seen = new Map<string, number>()
    return selected.flatMap((ref, index) => {
      const found = byId.get(ref)
      if (!found) return []
      const copy = (seen.get(ref) ?? 0) + 1
      seen.set(ref, copy)
      return [{ entity: found, ref, index, copy, total: totals.get(ref) ?? 1 }]
    })
  }, [schema, selected, idOf])
}

/**
 * The multi-select rail (toggle / count). A named region either way:
 *
 *   - narrow (`wide` false) — a sticky band whose heading IS a disclosure
 *     button. Collapsed it shows the count and a one-line budget readout;
 *     expanded, the full budget tracks and every chosen head with its Remove.
 *     It starts collapsed: on a small screen the results are the task, and each
 *     chosen card in the pool already wears its own seal.
 *   - wide — a column, always open: heading and budget tracks pinned, the list
 *     scrolling beneath, any actions pinned at the foot.
 *
 * Count changes are spoken by a polite live region — the count alone, and only
 * when it moves. Removing an entry hands focus to the entry now in its place,
 * or to the heading once the list is empty, so a keyboard user never lands on
 * <body> and can clear a list by pressing Remove repeatedly.
 */
function SelectionRail({
  wide,
  name,
  chosenLabel,
  schema,
  selected,
  idOf,
  budget,
  mode,
  onToggle,
  onRemove,
  hide,
  actions,
}: {
  wide: boolean
  name?: string
  chosenLabel: string
  schema: EntitySchemaName
  selected: string[]
  idOf: (item: EntityLike) => string
  budget?: BudgetConfig | BudgetConfig[]
  mode: 'toggle' | 'count'
  onToggle?: (ref: string) => void
  onRemove?: (index: number) => void
  hide: ReferenceEntityCardHideConfig
  actions?: ReactNode
}) {
  const budgets = budgetList(budget)
  const entries = useRailEntries(schema, selected, idOf)
  const [open, setOpen] = useState(false)
  const expanded = wide || open
  const headingId = useId()
  const listId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const removeRefs = useRef<Array<HTMLButtonElement | null>>([])
  const pendingFocus = useRef<{ position: number; length: number } | null>(null)
  const chosen = chosenLabel.toLowerCase()
  const announcement = useAnnouncement(`${entries.length} ${chosen}`)

  // The Remove button that had focus has just unmounted. Move focus once the
  // caller's `selected` has actually SHRUNK — so a caller that applies the
  // change asynchronously is still covered, and one that refuses it (or adds
  // something in the meantime) never has focus yanked later. A layout effect,
  // so focus moves before paint rather than resting on <body> for a frame.
  useLayoutEffect(() => {
    const pending = pendingFocus.current
    if (!pending || entries.length === pending.length) return
    pendingFocus.current = null
    if (entries.length > pending.length) return
    const next = removeRefs.current[Math.min(pending.position, entries.length - 1)]
    ;(next ?? toggleRef.current ?? headingRef.current)?.focus()
  }, [entries])

  function remove(entry: RailEntry, position: number) {
    pendingFocus.current = { position, length: entries.length }
    if (mode === 'count') onRemove?.(entry.index)
    else onToggle?.(entry.ref)
  }

  // Explicit spaces between the parts: an accessible name is built from text,
  // and without them it would read "Learned3".
  const title = (
    <>
      <span>{chosenLabel}</span>{' '}
      <Badge shape="chip" surface="solid">
        {entries.length}
      </Badge>
      {name && (
        <>
          {' '}
          <span style={RAIL_NAME_STYLE}>
            <span aria-hidden="true">· </span>
            {name}
          </span>
        </>
      )}
    </>
  )

  const budgetTracks = budgets.length > 0 && (
    <div style={BUDGET_STACK_STYLE}>
      {budgets.map((b) => (
        <BudgetTrack key={b.label} label={b.label} value={b.used} max={b.max} tone={b.tone} />
      ))}
    </div>
  )

  return (
    <section aria-labelledby={headingId} className="su-searcher__rail" style={RAIL_STYLE}>
      <div style={wide ? RAIL_HEAD_COLUMN_STYLE : RAIL_HEAD_BAND_STYLE}>
        <div style={wide ? undefined : RAIL_HEADING_SLOT_STYLE}>
          {wide ? (
            <PageHeading
              variant="section"
              as="h2"
              id={headingId}
              ref={headingRef}
              tabIndex={-1}
              className={FOCUS_RING}
            >
              <span style={RAIL_TITLE_STYLE}>{title}</span>
            </PageHeading>
          ) : (
            <PageHeading variant="section" as="h2" id={headingId}>
              <button
                ref={toggleRef}
                type="button"
                aria-expanded={open}
                aria-controls={listId}
                onClick={() => setOpen((v) => !v)}
                className={FOCUS_RING}
                style={RAIL_TOGGLE_STYLE}
              >
                {title}
                <ChevronDown aria-hidden="true" style={chevronStyle(open)} />
              </button>
            </PageHeading>
          )}
        </div>
        {wide ? budgetTracks : !open && budgets.length > 0 && <BudgetSummary budgets={budgets} />}
      </div>

      <div
        id={listId}
        hidden={!expanded}
        className="su-searcher__rail-list"
        style={RAIL_LIST_STYLE}
      >
        <div style={STACK_STYLE}>
          {!wide && budgetTracks}
          {entries.map((entry, position) => (
            <div
              key={`${entry.ref}#${entry.copy}`}
              data-testid="rail-entry"
              style={RAIL_ENTRY_STYLE}
            >
              <div style={RAIL_ENTRY_BODY_STYLE}>
                <ReferenceEntityCard data={entry.entity} size="medium" extent="head" hide={hide} />
                {entry.total > 1 && (
                  <span
                    className={capsLabel({ size: 'label', tracking: 'caps' })}
                    style={COPY_STYLE}
                  >
                    Copy {entry.copy} of {entry.total}
                  </span>
                )}
              </div>
              <Button
                ref={(el) => {
                  removeRefs.current[position] = el
                }}
                size="mini"
                onClick={() => remove(entry, position)}
                // Duplicates are legal in count mode, so each copy's button
                // names its copy — three identical "Remove Ion Cannon" buttons
                // are indistinguishable to a screen-reader user.
                aria-label={
                  entry.total > 1
                    ? `Remove ${entry.entity.name}, copy ${entry.copy} of ${entry.total}`
                    : `Remove ${entry.entity.name}`
                }
                style={REMOVE_STYLE}
              >
                ✕ Remove
              </Button>
            </div>
          ))}
          {entries.length === 0 && <p style={EMPTY_STYLE}>Nothing {chosen} yet.</p>}
        </div>
      </div>

      {actions && <div style={RAIL_ACTIONS_STYLE}>{actions}</div>}
      <span role="status" aria-live="polite" style={VISUALLY_HIDDEN}>
        {announcement}
      </span>
    </section>
  )
}

/**
 * The single-select rail: one line — the label, the chosen entity's NAME (its
 * card is right there in the pool, ringed), any budget and the confirm pair. No
 * disclosure, because there is nothing to fold, and no live region: the pool
 * is a radiogroup, and a radio already announces being checked.
 */
function ChosenBar({
  chosenLabel,
  schema,
  selected,
  idOf,
  budget,
  actions,
}: {
  chosenLabel: string
  schema: EntitySchemaName
  selected: string[]
  idOf: (item: EntityLike) => string
  budget?: BudgetConfig | BudgetConfig[]
  actions?: ReactNode
}) {
  const budgets = budgetList(budget)
  const chosen = useRailEntries(schema, selected, idOf)[0]
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="su-searcher__rail" style={BAR_STYLE}>
      <PageHeading variant="section" as="h2" id={headingId}>
        {chosenLabel}
      </PageHeading>
      {chosen ? (
        <span data-testid="rail-entry" style={BAR_CHOSEN_STYLE}>
          {chosen.entity.name}
        </span>
      ) : (
        <span style={EMPTY_STYLE}>Nothing {chosenLabel.toLowerCase()} yet.</span>
      )}
      {budgets.length > 0 && <BudgetSummary budgets={budgets} />}
      {actions && <div style={BAR_ACTIONS_STYLE}>{actions}</div>}
    </section>
  )
}

/** The collapsed band's budget: one running-text `Stat` per track, red when over. */
function BudgetSummary({ budgets }: { budgets: BudgetConfig[] }) {
  return (
    <p style={BUDGET_SUMMARY_STYLE}>
      {budgets.map((b) => (
        <span key={b.label} style={{ color: b.used > b.max ? color.statusBad : color.ink }}>
          <Stat
            orientation="horizontal"
            surface="plain"
            label={b.label}
            value={b.used}
            max={b.max}
            className={capsLabel({ size: 'badge', tracking: 'caps' })}
          />
        </span>
      ))}
    </p>
  )
}

// ---------------------------------------------------------------------------
// Budget track — honest over-capacity pips (soft, never blocks; mirrors mech)
// ---------------------------------------------------------------------------

function BudgetTrack({
  label,
  value,
  max,
  tone = 'default',
}: {
  label: string
  value: number
  max: number
  tone?: 'default' | 'ap'
}) {
  const total = Math.max(max, value)
  const isOver = value > max
  const fill = tone === 'ap' ? 'border-rust bg-rust' : 'border-ink bg-ink'
  return (
    <div>
      <p className="font-cond text-badge font-bold uppercase tracking-caps-wide text-ink">
        {label} ·{' '}
        <span className={cn('font-body text-xs font-bold', isOver && 'text-status-bad')}>
          {value} / {max}
        </span>
      </p>
      {total > 0 && (
        <div
          className="mt-1.5 flex flex-col gap-1"
          role="img"
          aria-label={`${label} ${value} of ${max}`}
        >
          {statBlockRowStarts(total).map(({ count, start }) => (
            <div key={start} className="flex gap-1">
              {Array.from({ length: count }).map((_, c) => {
                const i = start + c
                const on = i < value
                const over = i >= max
                return (
                  <span
                    key={i}
                    data-pip={on ? 'on' : 'off'}
                    className={cn(
                      'h-[13px] w-[13px] rounded-badge border-chrome',
                      on
                        ? over
                          ? 'border-status-bad bg-status-bad'
                          : fill
                        : 'border-ink bg-transparent'
                    )}
                  />
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
