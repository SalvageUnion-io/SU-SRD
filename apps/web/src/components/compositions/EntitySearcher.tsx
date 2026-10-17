/**
 * EntitySearcher — the one shared "add an entity" body for every live-sheet
 * and standalone picker modal (pilot equipment/abilities, mech systems/modules,
 * crawler weapons, chassis/NPC pickers) and the Dashboard's SRD Explorer.
 *
 * BROWSE, READ, KEEP. The pool is a list of Tokens, so a long collection
 * scans at a glance; the box before each Token adds it (or ticks it) without
 * leaving the list. Opening a Token shows that entity whole, as its medium
 * Card, with an action bar that adds or removes it — the detail is there when
 * it is wanted, never in the way of the list. What is already chosen sits in
 * its own sidebar of Tokens with the budgets.
 *
 * Persistence-agnostic: the caller owns `selected` and the add/remove handlers
 * (ADR-010). One identity both ways: an entity is chosen when `selected` holds
 * its `idOf`, and adding it emits that same `idOf` (default the entity name).
 *
 * `mode="single"` covers the exactly-one swaps (chassis, crawler type): the
 * box is a radio, the action bar says CHOOSE, and `railActions` carries the
 * confirm affordance. `hide` drops the Card sections a picker cannot act on.
 *
 * THE LAYOUT (in the `.su-searcher*` classes, styles/partials/controls.css):
 *   - from 64rem, three columns: the Token list, the focused Card, and the
 *     chosen sidebar, each scrolling alone. Something is always focused: the
 *     first chosen entity, else the first in the list.
 *   - below it, one column: the Token list over a bar holding the chosen
 *     count (a disclosure that opens the chosen list), the budgets and the
 *     actions. Opening a Token gives its Card the whole picker, with Back to
 *     list above and the action bar below; the list stays mounted, hidden, so
 *     its scroll position survives the round trip.
 *   - browse has no choosing: a grid of Tokens, each opening via `onOpen`.
 * DOM order follows the visual order, so focus order does too.
 *
 * NOTHING BELOW A FOLD. The frame is capped at the dynamic viewport and its
 * body takes what the header leaves, so on a phone the list and the bar are
 * always reachable. The toolbar is bounded too: only the Tech level chips sit
 * beside the search field (and only when wide); every other facet folds
 * behind Filters, whose panel scrolls on its own.
 *
 * THE PARTS. This module composes; each part lives beside it: the pool and
 * its facets (`useSearcherPool`), the toolbar (`EntitySearcherFilters`), the
 * focused Card (`EntitySearcherFocus`), the sidebar (`EntitySearcherRail`)
 * and its budgets (`EntitySearcherBudget`).
 */

import { X } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { EntitySchemaName } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { color, font, fontSize, radius, space, tracking, weight } from '../../design/tokens'
import { cn } from '../../lib/cn'
import { useDisclosure } from '../../lib/useDisclosure'
import { useMediaQuery } from '../../lib/useMediaQuery'
import { BandTitle } from '../atoms/BandTitle'
import { Button } from '../atoms/Button'
import { SearchField } from '../atoms/SearchField'
import { Card } from '../containers/Card'
import { Entity } from '../entity/Entity'
import type { EntityLinkAttrs } from '../entity/types'
import type { ReferenceEntityCardHideConfig } from '../referenceEntity/card/referenceEntityCardTypes'
import { SearcherToolbar } from './EntitySearcherFilters'
import { FocusPane } from './EntitySearcherFocus'
import { SelectionRail, SelectionStatus } from './EntitySearcherRail'
import type { BudgetConfig, EntityLike, FacetConfig, PoolEntity } from './entitySearcherTypes'
import { useSearcherPool } from './useSearcherPool'

type EntitySearcherProps = {
  /** Which reference collection to search. */
  schema: EntitySchemaName
  /** Refs currently on the sheet (may contain duplicates in `count` mode). */
  selected: string[]
  /**
   * `toggle` (default): one copy per entity — a Token's box, or the focused
   * Card's ADD / REMOVE, adds or removes it.
   * `count`: duplicates are legal — the box and ADD ANOTHER append a copy;
   * REMOVE takes the last copy off, and each copy has its own ✕ in the rail.
   * `single`: exactly one — the boxes are a `radiogroup`. The emission
   * contract is the same as `toggle` (the caller replaces its selection rather
   * than appending), so a single-select picker differs only in semantics, not
   * in wiring.
   * `browse`: nothing is chosen — a reference browser, not a picker (the
   * Dashboard's SRD Explorer). No rail, no boxes, no Status facet; a Token's
   * click emits `onOpen`.
   */
  mode?: 'toggle' | 'count' | 'single' | 'browse'
  /** toggle/single mode: add or remove (emits `idOf(item)` either way). */
  onToggle?: (ref: string) => void
  /** browse mode: open an entity (emits `idOf(item)`). */
  onOpen?: (ref: string) => void
  /** count mode: append one copy (emits `idOf(item)`). */
  onAdd?: (ref: string) => void
  /** count mode: remove the chosen entry at `index` in `selected`. */
  onRemove?: (index: number) => void
  /** An entity's identity in `selected`, and what adding it emits. Default: the entity name. */
  idOf?: (item: EntityLike) => string
  /** Narrow the pool (e.g. only weapons). Default: the whole collection. */
  filter?: (item: EntityLike) => boolean
  facets?: FacetConfig
  /** Optional soft budget(s) shown in the rail (never blocks selection). */
  budget?: BudgetConfig | BudgetConfig[]
  /** Who the picks land on, e.g. the pilot or mech name: the rail heading and
   * the ADD TO … button. */
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
  /** Close handler — renders the header's close badge, and DONE in the rail
   * of a toggle or count picker. */
  onClose?: () => void
  /**
   * Extra `hide` config for the focused Card, merged OVER the searcher's
   * own defaults (actions/choices are always suppressed). Big entities — a
   * chassis, a crawler type — carry sections a picker has no room for
   * (`{ patterns: true }`), and that is a property of the entity, not of the
   * surface, so it is the caller's call rather than a schema check in here.
   */
  hide?: ReferenceEntityCardHideConfig
  /** The mech builder's chassis picker: the focused Card shows its chassis
   * ability despite the forced `hide.actions` (E19). */
  showChassisAbility?: boolean
  /**
   * Actions pinned beneath the selection — e.g. the Apply/Cancel pair a
   * destructive picker needs. Always visible: at the foot of the rail column,
   * or in the bottom bar on a narrow screen. Replaces DONE.
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
  const { query, setQuery, pool, visible, countOf, facetRows, showRow, activeFilters } =
    useSearcherPool({ schema, selected, idOf, filter, facets, browse, chosenLabel })
  // The server snapshot is narrow, so a server render never commits to the
  // three columns.
  const wide = useMediaQuery(WIDE_QUERY, false)
  const filters = useDisclosure(false)
  const chosen = chosenLabel.toLowerCase()

  // ---- Focus: the entity whose Card is showing ----
  const [focusId, setFocusId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLButtonElement>(null)
  // Which way focus should move after the narrow view swaps (Card ↔ list).
  const pendingFocus = useRef<'back' | string | null>(null)
  // The whole collection, not the filtered pool: a rail entry the caller's
  // `filter` (or a facet) has since excluded can still be focused.
  const byId = useMemo(() => {
    const map = new Map<string, PoolEntity>()
    for (const e of SalvageUnionReference.findAllIn(schema, () => true) as PoolEntity[]) {
      if (!map.has(idOf(e))) map.set(idOf(e), e)
    }
    return map
  }, [schema, idOf])
  // Wide, something is always focused: the caller's pick, else the first
  // chosen entity, else the first in the list. Narrow, only what was opened.
  const defaultId = selected.find((ref) => byId.has(ref)) ?? (visible[0] && idOf(visible[0]))
  const focusedId = browse ? null : (focusId ?? (wide ? (defaultId ?? null) : null))
  const focused = focusedId ? byId.get(focusedId) : undefined
  const takeover = !wide && !!focused

  function open(ref: string) {
    if (!wide) pendingFocus.current = 'back'
    setFocusId(ref)
  }
  function back() {
    pendingFocus.current = focusedId
    setFocusId(null)
  }

  // A layout effect, so focus moves before paint: into the Card view on its
  // Back button, and back out onto the Token that opened it.
  useLayoutEffect(() => {
    const target = pendingFocus.current
    if (target === null) return
    pendingFocus.current = null
    if (target === 'back') {
      backRef.current?.focus()
      return
    }
    for (const el of listRef.current?.querySelectorAll<HTMLElement>('[data-searcher-open]') ?? []) {
      if (el.dataset.searcherOpen === target) {
        el.focus()
        return
      }
    }
  })

  // Toggle and single emit `onToggle` either way; count appends a copy.
  function add(ref: string) {
    if (mode === 'count') onAdd?.(ref)
    else onToggle?.(ref)
  }
  function removeOne(ref: string) {
    if (mode === 'count') {
      const index = selected.lastIndexOf(ref)
      if (index >= 0) onRemove?.(index)
    } else onToggle?.(ref)
  }

  // ---- Toolbar ----
  const techRow = facetRows.find((row) => row.label === TECH_ROW_LABEL) ?? null
  const inline = wide ? techRow : null
  const folded = [...facetRows.filter((row) => row !== inline), ...(showRow ? [showRow] : [])]
  const toolbar = (
    <SearcherToolbar
      search={
        <SearchField
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or trait…"
          aria-label="Search"
          autoComplete="off"
        />
      }
      inline={inline}
      folded={folded}
      activeFilters={activeFilters}
      filters={filters}
    />
  )

  // ---- The Token list ----
  const single = mode === 'single'
  const tokens = visible.map((item) => {
    const ref = idOf(item)
    const count = countOf(item)
    const token = (
      <Entity
        form="token"
        entity={item}
        mode={{
          kind: 'link',
          onOpen: () => (browse ? onOpen?.(ref) : open(ref)),
          // A data attribute, so Back to list can find the Token it left.
          attrs: { 'data-searcher-open': ref } as EntityLinkAttrs,
        }}
      />
    )
    if (browse) {
      return (
        <div key={item.id} className="su-searcher__item su-entity-token-line">
          {token}
        </div>
      )
    }
    return (
      <div
        key={item.id}
        className="su-searcher__item su-entity-token-line"
        data-focused={ref === focusedId || undefined}
      >
        <SelectBox mode={mode} name={item.name} count={count} onClick={() => add(ref)} />
        {token}
      </div>
    )
  })

  const browser = (
    <div ref={listRef} className="su-searcher__browser" hidden={takeover}>
      <div className="su-searcher__scroll" style={LIST_SCROLL_STYLE}>
        <p style={SUMMARY_STYLE}>
          Showing {visible.length} of {pool.length}
        </p>
        <div
          className="su-searcher__list"
          {...(single ? { role: 'radiogroup', 'aria-label': title ?? 'Options' } : {})}
        >
          {tokens}
        </div>
        {visible.length === 0 && <p style={POOL_EMPTY_STYLE}>{emptyMessage}</p>}
      </div>
    </div>
  )

  const focusMode = mode === 'browse' ? 'toggle' : mode
  const focusPane =
    !browse && (wide || focused) ? (
      focused ? (
        <FocusPane
          entity={focused}
          mode={focusMode}
          count={selected.filter((ref) => ref === focusedId).length}
          chosenLabel={chosenLabel}
          railName={railName}
          hide={cardHide}
          showChassisAbility={showChassisAbility}
          onAdd={() => focusedId && add(focusedId)}
          onRemove={
            (mode === 'count' ? onRemove : onToggle)
              ? () => focusedId && removeOne(focusedId)
              : undefined
          }
          onBack={wide ? undefined : back}
          backRef={backRef}
        />
      ) : (
        <div className="su-searcher__focus" />
      )
    ) : null

  const actions =
    railActions ??
    (onClose && !single ? (
      <Button variant="primary" size="compact" onClick={onClose}>
        Done
      </Button>
    ) : undefined)

  const rail = browse ? null : (
    <div className="su-searcher__rail-slot" hidden={takeover}>
      <SelectionRail
        wide={wide}
        name={railName}
        chosenLabel={chosenLabel}
        schema={schema}
        selected={selected}
        idOf={idOf}
        budget={budget}
        mode={focusMode}
        onToggle={onToggle}
        onRemove={onRemove}
        onFocus={open}
        actions={actions}
      />
    </div>
  )

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
      cardStyle={{ className: browse ? undefined : 'su-searcher-frame', style: FRAME_STYLE }}
      bodyStyle={BODY_STYLE}
    >
      {!takeover && toolbar}
      <div
        className={cn(
          'su-searcher',
          browse && 'su-searcher--browse',
          takeover && 'su-searcher--takeover'
        )}
      >
        {browser}
        {focusPane}
        {rail}
      </div>
      {!browse && <SelectionStatus message={`${selected.length} ${chosen}`} />}
    </Card>
  )
}

/**
 * The box before each Token: it chooses without opening. Toggle — a pressed
 * button with a tick; single — a radio; count — an Add button showing how many
 * copies are chosen.
 */
function SelectBox({
  mode,
  name,
  count,
  onClick,
}: {
  mode: 'toggle' | 'count' | 'single'
  name: string
  count: number
  onClick: () => void
}) {
  const on = count > 0
  if (mode === 'count') {
    return (
      <button
        type="button"
        className="su-searcher__mark"
        data-on={on || undefined}
        aria-label={`Add ${name}`}
        onClick={onClick}
      >
        {on ? count : <span aria-hidden="true">+</span>}
      </button>
    )
  }
  return (
    <button
      type="button"
      className="su-searcher__mark"
      data-on={on || undefined}
      {...(mode === 'single' ? { role: 'radio', 'aria-checked': on } : { 'aria-pressed': on })}
      aria-label={`Select ${name}`}
      onClick={onClick}
    >
      {on && <span aria-hidden="true">✓</span>}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Layout state + static styles
// ---------------------------------------------------------------------------

/**
 * The width at which the picker becomes three columns. Mirrors the
 * `.su-searcher` media query in styles/partials/controls.css — change both or
 * neither. CSS owns the LAYOUT; this only decides what the parts ARE at that
 * width: the rail a column or a bar, the Tech level chips inline or folded,
 * and whether something is always focused.
 */
const WIDE_QUERY = '(min-width: 64rem)'

/** The facet row that sits beside the search field when there is room. */
const TECH_ROW_LABEL = 'Tech level'

// Static properties only — every property that changes with the breakpoint
// lives in the `.su-searcher*` classes (the split rule).

/**
 * The frame never exceeds the DYNAMIC viewport (less the bare popup's 2rem
 * margins and any safe-area inset), so its body — allowed to shrink by
 * `BODY_STYLE` — always gets the room left under the header, and scrolls in
 * it. `dvh`, not `vh`: on a phone `100vh` is the toolbar-hidden height, which
 * would put the frame's foot under the browser chrome.
 */
const FRAME_STYLE = {
  maxHeight:
    'calc(100dvh - 4rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
} satisfies CSSProperties
const BODY_STYLE = {
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: color.paper,
} satisfies CSSProperties

const LIST_SCROLL_STYLE = {
  padding: `${space[12]} ${space[16]} ${space[16]}`,
} satisfies CSSProperties
const SUMMARY_STYLE = {
  margin: `${space[0]} ${space[0]} ${space[10]}`,
  fontFamily: font.cond,
  fontSize: fontSize.badge,
  fontWeight: weight.bold,
  textTransform: 'uppercase',
  letterSpacing: tracking.caps,
  color: color.wkMuted,
} satisfies CSSProperties
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
