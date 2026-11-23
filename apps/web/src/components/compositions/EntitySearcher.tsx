/**
 * EntitySearcher — the one shared "add an entity" body for every live-sheet
 * and standalone picker modal (pilot equipment/abilities, mech systems/modules,
 * crawler weapons, chassis/NPC pickers) and Play's SRD Explorer.
 *
 * BROWSE, READ, KEEP. The pool is a list of Minis, so a long collection
 * scans at a glance; a chosen one's line wears select mode's ring and its
 * `SelectedSeal` in the caller's word (EQUIPPED, 2 INSTALLED): hard rule R15. Opening a Mini shows that
 * entity whole, as its Page, with an action bar that adds it — the detail is
 * there when it is wanted, never in the way of the list. What is already
 * chosen sits in its own sidebar of Minis with the budgets, and removing is
 * done there.
 *
 * Persistence-agnostic: the caller owns `selected` and the add/remove handlers
 * (ADR-010). One identity both ways: an entity is chosen when `selected` holds
 * its `idOf`, and adding it emits that same `idOf` (default the entity name).
 *
 * `mode="single"` covers the exactly-one swaps (chassis, crawler type, a
 * system's one option): pick a row to read it, and the action bar's CHOOSE is
 * the one confirming press: the caller applies it and closes, with no Apply
 * step after it. `railActions` carries Cancel. `hide` drops the Card sections
 * a picker cannot act on.
 *
 * THE LAYOUT (in the `.su-searcher*` classes, styles/partials/controls.css):
 *   - from 64rem, the Mini list (a third of the width) and the chosen
 *     sidebar; opening a Mini fills the middle column with its Page. Each
 *     column scrolls alone. Until a Mini is opened the middle holds a callout
 *     saying what goes there.
 *   - below it, one column: the Mini list over a bar holding the chosen
 *     count (a disclosure that opens the chosen list), the budgets and the
 *     actions. Opening a Mini gives its Page the whole picker, with Back to
 *     list above and the action bar below; the list stays mounted, hidden, so
 *     its scroll position survives the round trip.
 *   - browse has no choosing: a grid of Minis, each opening via `onOpen`.
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
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { iconSize } from '../../design/tokens'
import { cn } from '../../lib/cn'
import { useDisclosure } from '../../lib/useDisclosure'
import { useMediaQuery } from '../../lib/useMediaQuery'
import { compositionsCopy } from '../../messages/components-compositions'
import { Badge } from '../atoms/Badge'
import { Button } from '../atoms/Button'
import { InsidePeekContext } from '../atoms/insidePeek'
import { SearchField } from '../atoms/SearchField'
import { Stat } from '../atoms/Stat'
import { EmptyState } from '../containers/EmptyState'
import { TitledBox } from '../containers/TitledBox'
import { holdToastsOnTop } from '../containers/toastPlacement'
import { paintFor } from '../entity'
import { Entity } from '../entity/Entity'
import { useEntitySurface } from '../entity/entitySurfaceContext'
import { SelectedSeal } from '../entity/modes/select'
import { PeekOffContext } from '../entity/peekContext'
import type { EntityLinkAttrs } from '../entity/types'
import type { ReferenceEntityCardHideConfig } from '../referenceEntity/card/referenceEntityCardTypes'
import { SearcherToolbar } from './EntitySearcherFilters'
import { FocusPane } from './EntitySearcherFocus'
import { SelectionRail, SelectionStatus } from './EntitySearcherRail'
import { RowAdd, RowFacts } from './EntitySearcherRow'
import { EntitySearcherSection } from './EntitySearcherSection'
import {
  BODY_STYLE,
  HOSTED_STYLE,
  LIST_SCROLL_STYLE,
  ROW_TAG_STYLE,
  SUBTITLE_CAPS,
  SUBTITLE_STYLE,
  SUMMARY_CAPS,
  SUMMARY_ROW_STYLE,
  SUMMARY_STYLE,
  WIDE_QUERY,
} from './entitySearcherStyles.model'
import type { EntityLike, EntitySearcherProps, PoolEntity } from './entitySearcherTypes'
import { NO_RESULTS } from './searchCopy'
import { namedBy } from './searcherFacts'
import { aboveTechLevel, TECH_LEVEL_ROW, useSearcherPool } from './useSearcherPool'

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
  techLevel,
  cost,
  budget,
  railName,
  chosenLabel = 'Selected',
  emptyMessage = NO_RESULTS,
  title,
  subtitle,
  onClose,
  hide,
  showChassisAbility,
  railActions,
  entities,
  lead,
  initialQuery,
  onQueryChange,
  focusExtra,
  railEntities,
  userMade,
  frame,
}: EntitySearcherProps) {
  // Actions/choices are never pickable inside a picker, so they are hidden
  // unless the caller asks for them (`hide.actions: false`: a denizen's
  // weapons are what the Mediator picks it by); anything else is its to suppress.
  const cardHide: ReferenceEntityCardHideConfig = { actions: true, ...hide, choices: true }
  const browse = mode === 'browse'
  const {
    query,
    setQuery,
    pool,
    visible,
    outside,
    activeTechLevels,
    countOf,
    facetRows,
    showRow,
    activeFilters,
    showAllTechLevels,
  } = useSearcherPool({
    schema,
    selected,
    idOf,
    filter,
    facets,
    entities,
    initialQuery,
    browse,
    chosenLabel,
    homeTechLevel: techLevel,
  })
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
    const all = entities ?? (SalvageUnionReference.findAllIn(schema, () => true) as PoolEntity[])
    for (const e of all) {
      if (!map.has(idOf(e))) map.set(idOf(e), e)
    }
    return map
  }, [schema, idOf, entities])
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
  // Back button, and back out onto the Mini that opened it.
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

  // ---- The keyboard's highlight (r4 E4): Down and Up move it through the rows
  // (other Tech Levels' named ones last), Enter acts on it. It clears when the
  // search changes, and after Enter adds: a second Enter waits for a row (r5 C5). ----
  const rows = useMemo(() => [...visible, ...outside], [visible, outside])
  const [cursorId, setCursorId] = useState<string | null>(null)
  const entered = useRef(false)
  const cursor = cursorId === null ? undefined : rows.find((item) => idOf(item) === cursorId)
  const rowId = useId()
  const domId = (item: PoolEntity) => `${rowId}-${item.id}`
  function moveCursor(step: 1 | -1) {
    if (rows.length === 0) return
    const at = cursor ? rows.indexOf(cursor) : -1
    const next = at === -1 ? (step === 1 ? 0 : rows.length - 1) : at + step
    const item = rows[Math.max(0, Math.min(rows.length - 1, next))]
    if (!item) return
    entered.current = false
    setCursorId(idOf(item))
    document.getElementById(domId(item))?.scrollIntoView?.({ block: 'nearest' })
  }

  // Toggle and single emit `onToggle` either way; count appends a copy.
  function add(ref: string) {
    if (mode === 'count') onAdd?.(ref)
    else onToggle?.(ref)
  }

  // The one picker convention: the search has focus when a picker opens beside
  // its detail pane, and Enter adds the first match; the picker stays open. A
  // phone keeps its keyboard down until the field is pressed.
  const searchRef = useRef<HTMLInputElement>(null)
  // Its Done is at the foot, where a toast lands: toasts stand at the top (r4 E12).
  useEffect(() => (browse ? undefined : holdToastsOnTop()), [browse])
  useEffect(() => {
    if (browse || !window.matchMedia(WIDE_QUERY).matches) return
    const frame = requestAnimationFrame(() => searchRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [browse])
  // Enter and a row's + (r6 E8) never remove, and pay the cost where they
  // can, as the bar's lead button does.
  function addNow(item: PoolEntity) {
    const price = cost?.(item)
    if (price?.canPay) price.onPay()
    else add(idOf(item))
  }
  function addFirstMatch() {
    // The highlighted row; else, typed, the first row the search NAMES (r4 E5:
    // never one matched only on rules text while a name matches), else the top.
    const q = query.trim()
    const first = cursor ?? (q ? (rows.find((item) => namedBy(item, q)) ?? visible[0]) : undefined)
    if (browse || !first || (entered.current && !cursor)) return
    const ref = idOf(first)
    if (mode === 'single') return open(ref) // A single pick applies on Choose: Enter reads.
    if (mode === 'count' || !selected.includes(ref)) {
      addNow(first)
      entered.current = true
      setCursorId(null)
    }
    if (wide) setFocusId(ref)
  }

  // ---- Toolbar: Tech level beside the search when there is room ----
  const techRow = facetRows.find((row) => row.label === TECH_LEVEL_ROW) ?? null
  const inline = wide ? techRow : null
  const folded = [...facetRows.filter((row) => row !== inline), ...(showRow ? [showRow] : [])]
  const toolbar = (
    <SearcherToolbar
      search={
        <SearchField
          ref={searchRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            entered.current = false
            setCursorId(null)
            onQueryChange?.(e.target.value)
          }}
          onKeyDown={(e) => {
            if (!browse && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
              e.preventDefault()
              moveCursor(e.key === 'ArrowDown' ? 1 : -1)
              return
            }
            if (e.key !== 'Enter') return
            e.preventDefault()
            addFirstMatch()
          }}
          aria-activedescendant={cursor ? domId(cursor) : undefined}
          enterKeyHint={browse ? undefined : 'done'}
          placeholder={compositionsCopy('searchByNameOrTrait')}
          aria-label={compositionsCopy('search')}
          autoComplete="off"
          containerClassName="su-searcher__search"
        />
      }
      inline={inline}
      folded={folded}
      // Filters counts what is set in its own panel (r4 E6): the Tech level
      // chips beside it are in plain sight and count for nothing there.
      activeFilters={activeFilters - (inline ? activeTechLevels : 0)}
      filters={filters}
    />
  )

  // ---- The Mini list ----
  const single = mode === 'single'
  const tokenOf = (item: PoolEntity) => {
    const ref = idOf(item)
    const count = countOf(item)
    const price = browse ? undefined : cost?.(item)
    const token = (
      <Entity
        size="mini"
        context="loadout"
        entity={item}
        mode={{
          kind: 'link',
          onOpen: () => (browse ? onOpen?.(ref) : open(ref)),
          // A data attribute, so the back control can find the Mini it left.
          attrs: { 'data-searcher-open': ref } as EntityLinkAttrs,
        }}
      />
    )
    if (browse) {
      return (
        <div key={item.id} className="su-searcher__item su-entity-mini-line">
          {token}
        </div>
      )
    }
    return (
      <div
        key={item.id}
        id={domId(item)}
        className="su-searcher__item su-entity-mini-line"
        data-focused={ref === focusedId || undefined}
        data-selected={count > 0 || undefined}
        data-cursor={item === cursor || undefined}
      >
        {token}
        {aboveTechLevel(item.techLevel, techLevel) && (
          <Badge shape="stamp" size="mini" surface="inverse" style={ROW_TAG_STYLE}>
            {compositionsCopy('aboveTech', { techLevel: techLevel ?? 0 })}
          </Badge>
        )}
        {price?.row && count === 0 && (
          <Stat size="mini" label={price.row.label} value={price.row.value} />
        )}
        {count > 0 && <SelectedSeal word={count > 1 ? `${count} ${chosenLabel}` : chosenLabel} />}
        {!single && (mode === 'count' || count === 0) && (
          <RowAdd name={item.name} onAdd={() => addNow(item)} />
        )}
        <RowFacts entity={item} wide={wide} />
      </div>
    )
  }
  // What the pick does not meet yet comes last, under its own head (r7 D5).
  const later = browse ? undefined : facets?.later
  const split = later ? visible.findIndex(later.of) : -1
  const tokens = (split === -1 ? visible : visible.slice(0, split)).map(tokenOf)

  const browser = (
    <div ref={listRef} className="su-searcher__browser" hidden={takeover}>
      <div className="su-searcher__scroll" style={LIST_SCROLL_STYLE}>
        <div style={SUMMARY_ROW_STYLE}>
          <p className={SUMMARY_CAPS} style={SUMMARY_STYLE}>
            {compositionsCopy('showingOf', { count: visible.length, count2: pool.length })}
            {outside.length > 0 &&
              ` · ${compositionsCopy('namedElsewhere', { count: outside.length })}`}
          </p>
          {techLevel !== undefined && showAllTechLevels && (
            <Button
              variant="ghost"
              size="mini"
              onClick={() => {
                showAllTechLevels()
                // The button goes as it is pressed: the cursor returns to Search, so
                // Enter still adds the first match (a phone keeps its keyboard down).
                if (window.matchMedia(WIDE_QUERY).matches) searchRef.current?.focus()
              }}
            >
              {compositionsCopy('showAllTechLevels')}
            </Button>
          )}
        </div>
        {/* A picker's entry opens its Page beside the list, so it has no hover
            card over the rows under it. */}
        <InsidePeekContext.Provider value={!browse}>
          <PeekOffContext.Provider value={!browse}>
            <div className={cn('su-searcher__list', browse && 'su-grid')}>{tokens}</div>
          </PeekOffContext.Provider>
        </InsidePeekContext.Provider>
        {visible.length === 0 && emptyMessage && (
          <EmptyState variant="inline" className="su-searcher__none" body={emptyMessage} />
        )}
        {/* What the search names in a Tech Level that is switched off (r4 E5):
            listed, tagged, and reachable by the arrow keys and Enter. */}
        {later && split !== -1 && (
          <EntitySearcherSection label={later.label}>
            {visible.slice(split).map(tokenOf)}
          </EntitySearcherSection>
        )}
        {!browse && outside.length > 0 && (
          <EntitySearcherSection label={compositionsCopy('inOtherTechLevels')}>
            {outside.map(tokenOf)}
          </EntitySearcherSection>
        )}
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
      listName={title}
      cost={cost?.(focused)}
      hide={cardHide}
      showChassisAbility={showChassisAbility}
      onAdd={() => {
        if (!focusedId) return
        add(focusedId)
        // On a phone the Page has the whole picker: an add returns to the
        // list for the next one (r4 E6). A single pick closes by itself.
        if (!wide && mode !== 'single') back()
      }}
      extra={focusExtra?.(focused)}
      budgets={wide || budget === undefined ? undefined : [budget].flat()}
      userMade={userMade}
      onBack={wide ? undefined : back}
      backRef={backRef}
    />
  ) : wide && !browse ? (
    // Nothing open yet: a note in the middle saying what goes there.
    <div className="su-searcher__empty">
      <EmptyState variant="quiet" body={compositionsCopy('openAnyEntryInThe')} />
    </div>
  ) : null

  const actions =
    railActions ??
    (onClose && !single ? (
      <Button variant="primary" size="compact" onClick={onClose}>
        {compositionsCopy('done')}
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
        resolved={railEntities}
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

  const searcher = (
    <>
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
    </>
  )

  // The host's frame: the toolbar on its band (the panel class carries the
  // controls' one height there too), the rest filling its body.
  if (frame) {
    return frame({
      toolbar: !takeover && (
        <div className="su-searcher-panel su-searcher__on-band">
          {lead}
          {toolbar}
        </div>
      ),
      body: (
        <section aria-label={title} className="su-searcher-panel" style={HOSTED_STYLE}>
          {searcher}
        </section>
      ),
    })
  }

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
      shrink
      body="flush"
      bodyStyle={BODY_STYLE}
      controls={
        onClose && (
          <Button
            onClick={onClose}
            aria-label={compositionsCopy('close')}
            variant="quiet"
            size="iconOnly"
          >
            <X aria-hidden="true" size={iconSize.compact} />
          </Button>
        )
      }
    >
      {subtitle && (
        <p className={SUBTITLE_CAPS} style={SUBTITLE_STYLE}>
          {subtitle}
        </p>
      )}
      {!takeover && lead}
      {!takeover && toolbar}
      {searcher}
    </TitledBox>
  )
}

// ---------------------------------------------------------------------------
// Layout state + static styles
// ---------------------------------------------------------------------------
