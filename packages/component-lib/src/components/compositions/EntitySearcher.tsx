/**
 * EntitySearcher — the one shared "add an entity" body for every live-sheet
 * and standalone picker modal (pilot equipment/abilities, mech systems/modules,
 * crawler weapons, chassis/NPC pickers). Drops into `SheetPickerModal` in place
 * of the ad-hoc wizard steps; the creation wizard keeps its own capped
 * count-stepper flow.
 *
 * It generalizes the mech Install step (TL filter chips + masonry + a running
 * loadout rail) with a live text search, a Status facet, and an always-visible rail so "what's
 * already on the sheet" vs. "what I can still add" reads at a glance instead of
 * being inferred from a faint selection ring.
 *
 * Persistence-agnostic: the caller owns `selected` and the add/remove handlers
 * (ADR-010). One identity both ways: a card is selected when `selected` holds
 * its `idOf`, and adding it emits that same `idOf` (default the entity name).
 *
 * `mode="single"` covers the exactly-one swaps (chassis, crawler type, pilot
 * class): a master/detail pair does not survive a large entity — a chassis
 * card is wider than a 220px track — so those pickers run here too, with `hide`
 * dropping the sections a picker
 * cannot act on and `railActions` carrying their confirm affordance.
 *
 * WHERE THE RAIL SITS. Never over the results: on a phone a floating rail
 * covers a third of what you are choosing from. Instead (layout in the
 * `.su-searcher*` classes in styles/index.css):
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
 *
 * THE PARTS. This module composes; each part lives beside it: the pool and
 * its facets (`useSearcherPool`), the sub-header (`EntitySearcherFilters`),
 * the rail (`EntitySearcherRail`) and its budgets (`EntitySearcherBudget`).
 */

import { X } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import type { EntitySchemaName } from 'salvageunion-reference'
import { color, font, fontSize, radius, space, tracking, weight } from '../../design/tokens'
import { SELECTED_RING } from '../../entity/modes/selectedRing'
import { cn } from '../../utils/cn'
import { useDisclosure } from '../../utils/useDisclosure'
import { useMediaQuery } from '../../utils/useMediaQuery'
import { BandTitle } from '../atoms/BandTitle'
import { Button } from '../atoms/Button'
import { SearchField } from '../atoms/SearchField'
import { Card } from '../containers/Card'
import { MasonryColumns } from '../containers/MasonryColumns'
import { ReferenceEntityCard } from '../referenceEntity/card/ReferenceEntityCard'
import type { ReferenceEntityCardHideConfig } from '../referenceEntity/card/referenceEntityCardTypes'
import { NarrowSubHeader, WideSubHeader } from './EntitySearcherFilters'
import { ChosenBar, SelectionRail } from './EntitySearcherRail'
import type { BudgetConfig, EntityLike, FacetConfig, PoolEntity } from './entitySearcherTypes'
import { useSearcherPool } from './useSearcherPool'

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
   * `browse`: nothing is chosen — a reference browser, not a picker (the
   * Dashboard's SRD Explorer). No rail, no Status facet, no on-sheet count; a
   * card's click emits `onOpen`.
   */
  mode?: 'toggle' | 'count' | 'single' | 'browse'
  /** toggle/single mode: add or remove (emits `idOf(item)` either way). */
  onToggle?: (ref: string) => void
  /** browse mode: open a card (emits `idOf(item)`). */
  onOpen?: (ref: string) => void
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
   * Extra `hide` config for the pool cards, merged OVER the searcher's
   * own defaults (actions/choices are always suppressed). Big entities — a
   * chassis, a crawler type — carry sections a picker has no room for
   * (`{ patterns: true }`), and that is a property of the entity, not of the
   * surface, so it is the caller's call rather than a schema check in here.
   */
  hide?: ReferenceEntityCardHideConfig
  /** The mech builder's chassis picker: each pick card shows its chassis
   * ability despite the forced `hide.actions` (E19). */
  showChassisAbility?: boolean
  /**
   * Actions pinned beneath the selection — e.g. the Apply/Cancel pair a
   * destructive picker needs. Always visible: at the foot of the rail column,
   * or in the band (collapsed or not) on a narrow screen and in single mode.
   * It is the one place a confirm affordance can sit without a second band
   * competing with it.
   */
  railActions?: ReactNode
}

/** The default `idOf`: module-level, so it is one function across renders. */
const nameOf = (item: EntityLike) => item.name

export function EntitySearcher({
  schema,
  selected,
  mode = 'toggle',
  onToggle,
  onOpen,
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
  showChassisAbility,
  railActions,
}: EntitySearcherProps) {
  // Actions/choices are never pickable inside a picker; anything else is the
  // caller's to suppress.
  const cardHide: ReferenceEntityCardHideConfig = { ...hide, actions: true, choices: true }
  const browse = mode === 'browse'
  const {
    query,
    setQuery,
    pool,
    visible,
    totalOnSheet,
    countOf,
    facetRows,
    showRow,
    activeFilters,
  } = useSearcherPool({ schema, selected, idOf, filter, facets, browse, chosenLabel })
  // The server snapshot is the band — the narrow default, like MasonryColumns'
  // one-column SSR snapshot — so a server render never commits to the column.
  const wide = useMediaQuery(WIDE_QUERY, false)
  // Narrow, the facet rows fold behind a Filters disclosure — and on a phone
  // they start folded: an ability picker's ~30 Tree chips alone outgrow it.
  const filters = useDisclosure(
    () => typeof window === 'undefined' || window.matchMedia(ROOMY_QUERY).matches
  )

  // ---- Sub-parts of the searcher Card ----
  const searchInput = (
    <SearchField
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Search by name or trait…"
      aria-label="Search"
      autoComplete="off"
    />
  )

  const summaryNode = (
    <span style={SUMMARY_STYLE}>
      {!browse && (
        <>
          <span style={INK_STYLE}>{totalOnSheet}</span> on sheet ·{' '}
        </>
      )}
      showing {visible.length} of {pool.length}
    </span>
  )

  // Wide, the facet rows sit in the sub-header; narrow, every row (Show
  // included) folds behind Filters. Both are bounded, so the header can never
  // again be taller than the screen.
  const subHeader = wide ? (
    <WideSubHeader facetRows={facetRows} showRow={showRow} search={searchInput} />
  ) : (
    <NarrowSubHeader
      rows={showRow ? [...facetRows, showRow] : facetRows}
      activeFilters={activeFilters}
      filters={filters}
      search={searchInput}
    />
  )

  const poolNode = (
    <div style={MIN_W_0_STYLE}>
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
          if (browse) {
            return (
              <ReferenceEntityCard
                key={item.id}
                data={item}
                size="medium"
                cardClickLabel={item.name}
                onCardClick={() => onOpen?.(idOf(item))}
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
              showChassisAbility={showChassisAbility}
            />
          )
        })}
      </MasonryColumns>
      {visible.length === 0 && <p style={POOL_EMPTY_STYLE}>{emptyMessage}</p>}
    </div>
  )

  const single = mode === 'single'
  const rail = browse ? null : single ? (
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
      headerBgColor="var(--color-pilot)"
      headerContent={
        <div style={HEADER_ROW_STYLE}>
          {/* Column, so `fill` is off on both — `flex-1` inside a flex-col
              would grow the title vertically, not claim the band's width.
              The wrapper takes the track instead and the titles truncate. */}
          <div style={HEADER_TITLES_STYLE}>
            <BandTitle className="su-searcher__band-title">{title}</BandTitle>
            {subtitle && (
              <BandTitle variant="mute" className="su-searcher__band-title">
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
              style={CLOSE_STYLE}
            >
              <X aria-hidden="true" size={16} />
            </Button>
          )}
        </div>
      }
      subHeader={subHeader}
      cardStyle={{ style: FRAME_STYLE }}
      bodyStyle={BODY_STYLE}
    >
      {/* `--bar` is the one-scroll-container layout; browse, with no rail
          column to sit beside, takes it too. */}
      <div className={cn('su-searcher', (single || browse) && 'su-searcher--bar')}>
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

const SUMMARY_STYLE = {
  whiteSpace: 'nowrap',
  fontFamily: font.cond,
  fontSize: fontSize.badge,
  fontWeight: weight.bold,
  textTransform: 'uppercase',
  letterSpacing: tracking.caps,
  color: color.wkMuted,
} satisfies CSSProperties
const INK_STYLE = { color: color.ink } satisfies CSSProperties
const MIN_W_0_STYLE = { minWidth: 0 } satisfies CSSProperties
const POOL_EMPTY_STYLE = {
  marginTop: space[12],
  fontFamily: font.body,
  fontSize: fontSize.sm,
  lineHeight: '1.25rem',
  color: color.wkMuted,
} satisfies CSSProperties

const HEADER_ROW_STYLE = {
  display: 'flex',
  width: '100%',
  alignItems: 'center',
  gap: space[12],
} satisfies CSSProperties
const HEADER_TITLES_STYLE = {
  display: 'flex',
  minWidth: 0,
  flex: '1 1 0%',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: space[2],
} satisfies CSSProperties
const CLOSE_STYLE = {
  borderRadius: radius.badge,
  fontFamily: font.cond,
  fontWeight: weight.bold,
} satisfies CSSProperties

/** `isolation` keeps a pool card's own stacking (a hovered card's z-10, a
 * seam stamp's z-30) inside the pool, so the sticky band always paints over it. */
const POOL_STYLE = { padding: space[16], isolation: 'isolate' } satisfies CSSProperties
const SUMMARY_ROW_STYLE = { marginBottom: space[12] } satisfies CSSProperties

const COUNT_CARD_STYLE = { borderRadius: radius.panel } satisfies CSSProperties
/** The installed ring — a 3px ink spread, as the `shadow-[…]` it ports drew. */
const COUNT_CARD_INSTALLED_STYLE = {
  ...COUNT_CARD_STYLE,
  ...SELECTED_RING,
} satisfies CSSProperties
const COUNT_FOOT_STYLE = {
  marginTop: space[6],
  display: 'flex',
  alignItems: 'center',
  gap: space[8],
  paddingLeft: space[4],
  paddingRight: space[4],
} satisfies CSSProperties
const COUNT_LABEL_STYLE = {
  fontFamily: font.cond,
  fontSize: fontSize.badge,
  fontWeight: weight.bold,
  textTransform: 'uppercase',
  letterSpacing: tracking.caps,
  color: color.ink,
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
    <div style={installed ? COUNT_CARD_INSTALLED_STYLE : COUNT_CARD_STYLE}>
      <ReferenceEntityCard data={entity} size="medium" hide={hide} />
      <div style={COUNT_FOOT_STYLE}>
        {installed && <span style={COUNT_LABEL_STYLE}>{count} Added</span>}
        <Button size="mini" onClick={onAdd} aria-label={`Add ${entity.name}`}>
          {installed ? '+ Add another' : '+ Add'}
        </Button>
      </div>
    </div>
  )
}
