/**
 * `EntitySearcher`'s selection rail: what is already on the sheet, beside or
 * above the pool and never over it (layout in the `.su-searcher*` classes).
 * `SelectionRail` is the multi-select rail (toggle / count); `ChosenBar` the
 * one-line single-select band.
 */

import { ChevronDown } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { EntitySchemaName } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { borderWidth, color, font, fontSize, radius, space, weight } from '../../design/tokens'
import { Entity } from '../../entity/Entity'
import { Badge } from '../atoms/Badge'
import { Button } from '../atoms/Button'
import { capsLabel } from '../atoms/capsLabel'
import { FOCUS_RING } from '../atoms/interaction'
import { PageHeading } from '../atoms/PageHeading'
import { BudgetSummary, BudgetTrack } from './EntitySearcherBudget'
import { chevronStyle, VISUALLY_HIDDEN } from './entitySearcherChrome'
import type { BudgetConfig, EntityLike, PoolEntity } from './entitySearcherTypes'

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
export function SelectionRail({
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
                <Entity form="row" entity={entry.entity} />
                {entry.total > 1 && (
                  <span
                    className={capsLabel({ size: 'badge', tracking: 'caps' })}
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
export function ChosenBar({
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
