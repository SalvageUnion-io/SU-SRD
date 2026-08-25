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
 * (ADR-010). Detection uses `matchesRef` (id | name | slug) so it is robust to
 * however a given collection stores its refs; the emitted identity on add is
 * the caller's `idOf` (default the entity name).
 *
 * `mode="single"` covers the exactly-one swaps (chassis, crawler type, pilot
 * class), which used to be hand-rolled master/detail pairs: a narrow option
 * rail beside a preview pane. That shape does not survive a large entity —
 * a chassis card is wider than a 220px track, so every option rendered clipped —
 * so those pickers now run here too, with `hide` dropping the sections a picker
 * cannot act on and `railActions` carrying their confirm affordance.
 */

import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import type {
  EntitySchemaName,
  SchemaToEntityMap,
  SURefEnumSchemaName,
} from 'salvageunion-reference'
import { SalvageUnionReference, searchIn, techLevelRank } from 'salvageunion-reference'
import type { TechLevel } from 'salvageunion-reference/rules'
import { matchesRef } from 'salvageunion-reference/rules'
import { cn } from '../../utils/cn'
import { Badge } from '../chrome/Badge'
import { BandTitle } from '../chrome/BandTitle'
import { Button } from '../chrome/Button'
import { FOCUS_WITHIN } from '../chrome/interaction'
import { PageHeading } from '../chrome/PageHeading'
import { Panel } from '../chrome/Panel'
import type { ReferenceEntityCardHideConfig } from '../referenceEntity/card/ReferenceEntityCard'
import { ReferenceEntityCard } from '../referenceEntity/card/ReferenceEntityCard'
import { statBlockRowStarts } from '../stat/pipRows'
import { Card } from './Card'
import { FilterRow } from './FilterRow'
import { MasonryColumns } from './MasonryColumns'

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
  /** toggle/single mode: add (emits `idOf(item)`) or remove (emits the matched ref). */
  onToggle?: (ref: string) => void
  /** count mode: append one copy (emits `idOf(item)`). */
  onAdd?: (ref: string) => void
  /** count mode: remove the chosen entry at `index` in `selected`. */
  onRemove?: (index: number) => void
  /** Identity emitted when adding. Default: the entity name. */
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
   * Actions pinned to the bottom of the selection rail — e.g. the Apply/Cancel
   * pair a destructive picker needs. The rail floats over the card frame, so
   * this is the one place a confirm affordance can sit without a second band
   * competing with it.
   */
  railActions?: ReactNode
}

const ALL_TLS: TechLevel[] = [1, 2, 3, 4, 5, 6, 'B', 'N']

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
  idOf = (item) => item.name,
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

  // Identity helpers — detection is ref-tolerant, emission uses `idOf`.
  const countOf = (item: EntityLike) => selected.filter((ref) => matchesRef(item, ref)).length
  const matchedRef = (item: EntityLike) => selected.find((ref) => matchesRef(item, ref))

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
        const has = selected.some((ref) => matchesRef(item, ref))
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
  ])

  const selectedCount = selected.length
  const totalOnSheet = useMemo(
    () => pool.reduce((n, item) => n + selected.filter((ref) => matchesRef(item, ref)).length, 0),
    [pool, selected]
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

  // Sub-header: the facet rows, with the search field on the final row spaced
  // OPPOSITE the "Show" facet.
  const floatingSubHeader = (
    <div className="flex w-full flex-col gap-2">
      {facetRowConfigs.map(renderFacetRow)}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {showRowConfig ? renderFacetRow(showRowConfig) : <span aria-hidden="true" />}
        <div className="w-full sm:w-[280px]">{searchInput}</div>
      </div>
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
              onCardClick={() =>
                onToggle?.(isSelected ? (matchedRef(item) ?? idOf(item)) : idOf(item))
              }
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

  // A self-contained Card: title + close badge in the header, search +
  // all filters in the sub-header band, the pool filling a padded internally-
  // scrolling body, and the "Results" box pinned floating bottom-right.
  return (
    <div className="relative">
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
        subHeader={floatingSubHeader}
      >
        {/* Internally-scrolling body; extra bottom padding clears the pinned
            Results box so the last rows are never hidden beneath it. */}
        <div className="max-h-[min(62vh,640px)] overflow-y-auto p-4 pb-28">
          <div className="mb-3">{summaryNode}</div>
          {poolNode}
        </div>
      </Card>

      {/* Pinned floating "Results" box — absolute to the card frame (NOT the
          scrolling body), so it stays put in the bottom-right above content.
          The wrapper is click-through; only the box captures pointer events. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-end p-4">
        <div className="pointer-events-auto w-[360px] max-w-[calc(100%-2rem)]">
          <SelectionRail
            name={railName}
            chosenLabel={chosenLabel}
            count={selectedCount}
            schema={schema}
            selected={selected}
            budget={budget}
            mode={mode}
            onToggle={onToggle}
            onRemove={onRemove}
            hide={cardHide}
            actions={railActions}
            className="max-h-[45vh] overflow-y-auto shadow-[0_6px_24px_var(--color-ink-30)]"
          />
        </div>
      </div>
    </div>
  )
}

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
// Selection rail — always-visible list of what's on the sheet + soft budget
// ---------------------------------------------------------------------------

function SelectionRail({
  name,
  chosenLabel,
  count,
  schema,
  selected,
  budget,
  mode,
  onToggle,
  onRemove,
  hide,
  actions,
  className,
}: {
  name?: string
  chosenLabel: string
  count: number
  schema: EntitySchemaName
  selected: string[]
  budget?: BudgetConfig | BudgetConfig[]
  mode: 'toggle' | 'count' | 'single'
  onToggle?: (ref: string) => void
  onRemove?: (index: number) => void
  hide: ReferenceEntityCardHideConfig
  actions?: ReactNode
  className?: string
}) {
  const budgets = budget ? (Array.isArray(budget) ? budget : [budget]) : []
  const entries = useMemo(() => {
    const all: PoolEntity[] = SalvageUnionReference.findAllIn(schema, () => true)
    const totals = new Map<string, number>()
    for (const ref of selected) totals.set(ref, (totals.get(ref) ?? 0) + 1)
    const seen = new Map<string, number>()
    return selected.flatMap((ref, index) => {
      const found = all.find((e) => matchesRef(e, ref))
      if (!found) return []
      const copy = (seen.get(ref) ?? 0) + 1
      seen.set(ref, copy)
      return [{ entity: found, ref, index, copy, total: totals.get(ref) ?? 1 }]
    })
  }, [schema, selected])

  return (
    <Panel className={cn('self-start px-4 py-4', className)}>
      <PageHeading variant="section" as="h2" className="text-ink">
        {name ? (
          <>
            {chosenLabel} · <span className="text-ink-75">{name}</span>
          </>
        ) : (
          <>
            {chosenLabel} <span className="text-ink-75">{count}</span>
          </>
        )}
      </PageHeading>

      {budgets.length > 0 && (
        <div className="mt-3 space-y-3">
          {budgets.map((b) => (
            <BudgetTrack key={b.label} label={b.label} value={b.used} max={b.max} tone={b.tone} />
          ))}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {entries.map(({ entity, ref, index, copy, total }) => (
          <div key={index} data-testid="rail-entry" className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <ReferenceEntityCard data={entity} size="medium" extent="head" hide={hide} />
              {total > 1 && (
                <span className="mt-0.5 block px-1 font-cond text-label font-bold uppercase tracking-caps text-wk-muted">
                  Copy {copy} of {total}
                </span>
              )}
            </div>
            <Button
              size="mini"
              onClick={() => (mode === 'count' ? onRemove?.(index) : onToggle?.(ref))}
              aria-label={`Remove ${entity.name}`}
              className="mt-0.5 shrink-0"
            >
              ✕ Remove
            </Button>
          </div>
        ))}
        {entries.length === 0 && (
          <p className="font-body text-xs text-wk-muted">
            Nothing {chosenLabel.toLowerCase()} yet.
          </p>
        )}
      </div>

      {actions && <div className="mt-4 flex flex-wrap justify-end gap-2">{actions}</div>}
    </Panel>
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
