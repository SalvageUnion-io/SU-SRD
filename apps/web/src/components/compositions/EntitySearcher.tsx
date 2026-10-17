/**
 * EntitySearcher — the one shared "add an entity" body for every live-sheet
 * and standalone picker modal (pilot equipment/abilities, mech systems/modules,
 * crawler weapons, chassis/NPC pickers) and the Dashboard's SRD Explorer.
 *
 * BROWSE, READ, KEEP. The pool is a list of Tokens, so a long collection
 * scans at a glance; a chosen Token wears the selection ring with its chosen
 * label (EQUIPPED, 2 INSTALLED) joined to it. Opening a Token shows that
 * entity whole, as its Page, with an action bar that adds it — the detail is
 * there when it is wanted, never in the way of the list. What is already
 * chosen sits in its own sidebar of Tokens with the budgets, and removing is
 * done there.
 *
 * Persistence-agnostic: the caller owns `selected` and the add/remove handlers
 * (ADR-010). One identity both ways: an entity is chosen when `selected` holds
 * its `idOf`, and adding it emits that same `idOf` (default the entity name).
 *
 * `mode="single"` covers the exactly-one swaps (chassis, crawler type): the
 * action bar says CHOOSE, and `railActions` carries the confirm affordance. `hide` drops the Card sections a picker cannot act on.
 *
 * THE LAYOUT (in the `.su-searcher*` classes, styles/partials/controls.css):
 *   - from 64rem, the Token list (a third of the width) and the chosen
 *     sidebar; opening a Token fills the middle column with its Page. Each
 *     column scrolls alone. Until a Token is opened the middle holds a callout
 *     saying what goes there.
 *   - below it, one column: the Token list over a bar holding the chosen
 *     count (a disclosure that opens the chosen list), the budgets and the
 *     actions. Opening a Token gives its Page the whole picker, with Back to
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
 * focused Page (`EntitySearcherFocus`), the sidebar (`EntitySearcherRail`)
 * and its budgets (`EntitySearcherBudget`).
 */

import { X } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { EntitySchemaName } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { color, font, fontSize, space, tracking, weight } from '../../design/tokens'
import { cn } from '../../lib/cn'
import { useDisclosure } from '../../lib/useDisclosure'
import { useMediaQuery } from '../../lib/useMediaQuery'
import { Button } from '../atoms/Button'
import { buttonVariants } from '../atoms/buttonVariants'
import { SearchField } from '../atoms/SearchField'
import { Callout } from '../containers/Callout'
import { TitledBox } from '../containers/TitledBox'
import { Entity } from '../entity/Entity'
import { useEntitySurface } from '../entity/entitySurfaceContext'
import { paintFor } from '../entity/parts/paint'
import type { EntityLinkAttrs } from '../entity/types'
import type { ReferenceEntityCardHideConfig } from '../referenceEntity/card/referenceEntityCardTypes'
import { SearcherToolbar } from './EntitySearcherFilters'
import { FocusPane } from './EntitySearcherFocus'
import { SelectionRail, SelectionStatus } from './EntitySearcherRail'
import type { BudgetConfig, EntityLike, FacetConfig, PoolEntity } from './entitySearcherTypes'
import { TECH_LEVEL_ROW, useSearcherPool } from './useSearcherPool'

type EntitySearcherProps = {
  /** Which reference collection to search. */
  schema: EntitySchemaName
  /** Refs currently on the sheet (may contain duplicates in `count` mode). */
  selected: string[]
  /**
   * `toggle` (default): one copy per entity — the focused Page's ADD adds it,
   * its ✕ in the rail removes it.
   * `count`: duplicates are legal — ADD ANOTHER appends a copy, and each copy
   * has its own ✕ in the rail.
   * `single`: exactly one — the focused Page's CHOOSE picks it. The emission
   * contract is the same as `toggle` (the caller replaces its selection rather
   * than appending), so a single-select picker differs only in semantics, not
   * in wiring.
   * `browse`: nothing is chosen — a reference browser, not a picker (the
   * Dashboard's SRD Explorer). No rail, no Status facet; a Token's
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
   * Extra `hide` config for the focused Page, merged OVER the searcher's
   * own defaults (actions/choices are always suppressed). Big entities — a
   * chassis, a crawler type — carry sections a picker has no room for
   * (`{ patterns: true }`), and that is a property of the entity, not of the
   * surface, so it is the caller's call rather than a schema check in here.
   */
  hide?: ReferenceEntityCardHideConfig
  /** The mech builder's chassis picker: the focused Page shows its chassis
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
  const surface = useEntitySurface()
  const paint = paintFor('pilot', { texture: surface.texture })
  const chosen = chosenLabel.toLowerCase()

  // ---- Focus: the entity whose Page is showing ----
  const [focusId, setFocusId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLButtonElement>(null)
  // Which way focus should move after the narrow view swaps (Page ↔ list).
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
  // Only what was opened: until then the list stands alone.
  const focusedId = browse ? null : focusId
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

  // A layout effect, so focus moves before paint: into the Page view on its
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

  // ---- Toolbar: Tech level beside the search when there is room ----
  const techRow = facetRows.find((row) => row.label === TECH_LEVEL_ROW) ?? null
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
          containerClassName="su-searcher__search"
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
        context="loadout"
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
        data-selected={count > 0 || undefined}
      >
        {token}
        {count > 0 && (
          <span className="su-searcher__chosen">
            {count > 1 ? `${count} ${chosenLabel}` : chosenLabel}
          </span>
        )}
      </div>
    )
  })

  const browser = (
    <div ref={listRef} className="su-searcher__browser" hidden={takeover}>
      <div className="su-searcher__scroll" style={LIST_SCROLL_STYLE}>
        <p style={SUMMARY_STYLE}>
          Showing {visible.length} of {pool.length}
        </p>
        <div className="su-searcher__list">{tokens}</div>
        {visible.length === 0 && <p style={POOL_EMPTY_STYLE}>{emptyMessage}</p>}
      </div>
    </div>
  )

  const focusMode = mode === 'browse' ? 'toggle' : mode
  const focusPane = focused ? (
    <FocusPane
      entity={focused}
      mode={focusMode}
      count={selected.filter((ref) => ref === focusedId).length}
      chosenLabel={chosenLabel}
      railName={railName}
      hide={cardHide}
      showChassisAbility={showChassisAbility}
      onAdd={() => focusedId && add(focusedId)}
      onBack={wide ? undefined : back}
      backRef={backRef}
    />
  ) : wide && !browse ? (
    // Nothing open yet: a note in the middle saying what goes there.
    <div className="su-searcher__empty">
      <Callout>Open any entry in the list to read it here, then add it from its page.</Callout>
    </div>
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

  // The cut-out head every titled container wears (`TitledBox`, as ModalShell
  // draws it): the band in the pilot tone, the title on a square paper tab
  // notched into its foot, the × on the band. A dialog's head is its chrome,
  // level 0 (ruleset §5, N6), so the opened entry's Page under it is level 0
  // too.
  return (
    <TitledBox
      as="section"
      title={title ?? ''}
      paint={paint}
      className={cn('su-modal-panel su-searcher-panel', !browse && 'su-searcher-frame')}
      body="flush"
      bodyStyle={BODY_STYLE}
      controls={
        onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={buttonVariants({ variant: 'quiet', size: 'iconOnly' })}
          >
            <X aria-hidden="true" style={CLOSE_ICON_STYLE} />
          </button>
        )
      }
    >
      {subtitle && <p style={SUBTITLE_STYLE}>{subtitle}</p>}
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
    </TitledBox>
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
 * and whether an opened Token takes the picker over.
 */
const WIDE_QUERY = '(min-width: 64rem)'

// Static properties only — every property that changes with the breakpoint
// lives in the `.su-searcher*` classes (the split rule).

/** The body shrinks with the frame's cap (`.su-searcher-panel`), so the
 * searcher under the head takes what is left and scrolls in it. */
const BODY_STYLE = { minHeight: 0 } satisfies CSSProperties

/** The subtitle: a line of the paper under the cut-out, as ModalShell's. */
const SUBTITLE_STYLE = {
  margin: space[0],
  padding: `${space[10]} ${space[16]} ${space[0]}`,
  fontFamily: font.cond,
  fontSize: fontSize.xs,
  fontWeight: weight.bold,
  letterSpacing: tracking.capsTight,
  lineHeight: 1.2,
  textTransform: 'uppercase',
  color: color.wkMuted,
} satisfies CSSProperties

const CLOSE_ICON_STYLE = { width: space[20], height: space[20] } satisfies CSSProperties

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
