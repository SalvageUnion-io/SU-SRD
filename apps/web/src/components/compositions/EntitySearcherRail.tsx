/**
 * `EntitySearcher`'s selection rail: what is already chosen, as Tokens, with
 * the budgets and the picker's own actions. Never over the results: on a wide
 * screen it is the column right of the focused Card; on a narrow one it is a
 * bar at the foot of the picker whose disclosure opens the chosen list above
 * it.
 */

import { ChevronDown, X } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { EntitySchemaName } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { borderWidth, color, font, fontSize, radius, space } from '../../design/tokens'
import { cn } from '../../lib/cn'
import { useDisclosure } from '../../lib/useDisclosure'
import { Badge } from '../atoms/Badge'
import { Button } from '../atoms/Button'
import { FOCUS_RING } from '../atoms/interaction'
import { PageHeading } from '../atoms/PageHeading'
import { Entity } from '../entity/Entity'
import { BudgetChips } from './EntitySearcherBudget'
import { chevronStyle } from './entitySearcherChrome'
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

/**
 * The polite live region that speaks the chosen count when it changes. Not in
 * the rail: on a phone the rail is hidden while one entity's Card fills the
 * picker, and that is exactly when ADD changes the count.
 */
export function SelectionStatus({ message }: { message: string }) {
  const announcement = useAnnouncement(message)
  return (
    <span role="status" aria-live="polite" className="su-sr-only">
      {announcement}
    </span>
  )
}

type RailEntry = {
  entity: PoolEntity
  /** The stored ref, as the caller holds it (toggle mode removes by ref). */
  ref: string
  /** Position in `selected` (count mode removes by index). */
  index: number
  copy: number
  total: number
}

/** `selected`, resolved by `idOf` against the whole collection (not the
 * filtered pool), with each duplicate numbered — "copy 2 of 3". Unresolvable
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
 * The rail, a named region either way:
 *
 *   - wide — a column, always open: the heading and budgets pinned, the
 *     chosen Tokens scrolling beneath, the actions pinned at the foot.
 *   - narrow — a bar at the foot: the heading IS a disclosure button, beside
 *     the budgets and the actions; open, the chosen list sits above the bar.
 *     It starts closed: on a small screen the results are the task, and each
 *     chosen entry in the list already wears its tick.
 *
 * A chosen Token focuses that entry's Card (`onFocus`). In toggle and count
 * mode each has a Remove (✕); a single pick is replaced by picking another, so
 * it has none. Removing an entry hands focus to the entry now in its place, or to the heading once
 * the list is empty, so a keyboard user never lands on <body>.
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
  onFocus,
  actions,
}: {
  wide: boolean
  name?: string
  chosenLabel: string
  schema: EntitySchemaName
  selected: string[]
  idOf: (item: EntityLike) => string
  budget?: BudgetConfig | BudgetConfig[]
  mode: 'toggle' | 'count' | 'single'
  onToggle?: (ref: string) => void
  onRemove?: (index: number) => void
  onFocus: (ref: string) => void
  actions?: ReactNode
}) {
  const budgets = budget ? (Array.isArray(budget) ? budget : [budget]) : []
  const entries = useRailEntries(schema, selected, idOf)
  const list = useDisclosure()
  const expanded = wide || list.open
  const headingId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const removeRefs = useRef<Array<HTMLButtonElement | null>>([])
  const pendingFocus = useRef<{ position: number; length: number } | null>(null)
  const chosen = chosenLabel.toLowerCase()
  const removable = mode !== 'single' && Boolean(mode === 'count' ? onRemove : onToggle)

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
  // and without them it would read "Equipped3".
  const title = (
    <>
      <span>{chosenLabel}</span> <Badge shape="chip">{entries.length}</Badge>
      {name && (
        <>
          {' '}
          <span style={NAME_STYLE}>
            <span aria-hidden="true">· </span>
            {name}
          </span>
        </>
      )}
    </>
  )

  const listNode = (
    <div id={list.panelId} hidden={!expanded} className="su-searcher__rail-list" style={LIST_STYLE}>
      {entries.map((entry, position) => (
        <div key={`${entry.ref}#${entry.copy}`} data-testid="rail-entry" style={ENTRY_STYLE}>
          <div className="su-entity-token-line" style={ENTRY_TOKEN_STYLE}>
            <Entity
              form="token"
              entity={entry.entity}
              mode={{ kind: 'link', onOpen: () => onFocus(entry.ref) }}
            />
          </div>
          {removable && (
            <Button
              ref={(el) => {
                removeRefs.current[position] = el
              }}
              size="mini"
              className="su-searcher__remove"
              onClick={() => remove(entry, position)}
              // Duplicates are legal in count mode, so each copy's button
              // names its copy — three identical "Remove Ion Cannon" buttons
              // are indistinguishable to a screen-reader user.
              aria-label={
                entry.total > 1
                  ? `Remove ${entry.entity.name}, copy ${entry.copy} of ${entry.total}`
                  : `Remove ${entry.entity.name}`
              }
            >
              <X aria-hidden="true" size={12} />
            </Button>
          )}
        </div>
      ))}
      {entries.length === 0 && <p style={EMPTY_STYLE}>Nothing {chosen} yet.</p>}
    </div>
  )

  const budgetNode = budgets.length > 0 && (
    <div className="su-searcher__budgets" style={BUDGET_ROW_STYLE}>
      <BudgetChips budgets={budgets} />
    </div>
  )

  if (wide) {
    return (
      <section aria-labelledby={headingId} className="su-searcher__rail" style={RAIL_STYLE}>
        <div style={HEAD_STYLE}>
          <PageHeading
            variant="section"
            as="h2"
            id={headingId}
            ref={headingRef}
            tabIndex={-1}
            className={FOCUS_RING}
          >
            <span style={TITLE_STYLE}>{title}</span>
          </PageHeading>
          {budgetNode}
        </div>
        {listNode}
        {actions && <div style={ACTIONS_STYLE}>{actions}</div>}
      </section>
    )
  }

  return (
    <section aria-labelledby={headingId} className="su-searcher__rail" style={RAIL_STYLE}>
      {listNode}
      <div className="su-searcher__bar" style={BAR_STYLE}>
        <div style={BAR_HEADING_STYLE}>
          <PageHeading variant="section" as="h2" id={headingId}>
            <button
              ref={toggleRef}
              type="button"
              {...list.toggleProps}
              className={cn('su-searcher__bar-toggle', FOCUS_RING)}
              style={TOGGLE_STYLE}
            >
              {title}
              <ChevronDown aria-hidden="true" style={chevronStyle(list.open)} />
            </button>
          </PageHeading>
        </div>
        {budgetNode}
        {actions && <div style={BAR_ACTIONS_STYLE}>{actions}</div>}
      </div>
    </section>
  )
}

const RAIL_STYLE = { backgroundColor: color.paper, color: color.ink } satisfies CSSProperties

/** Wide: the heading over the budget chips, pinned above the list. */
const HEAD_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
  padding: `${space[12]} ${space[16]}`,
  borderBottom: `${borderWidth.hairline} solid ${color.ink20}`,
} satisfies CSSProperties

const TITLE_STYLE = {
  display: 'flex',
  alignItems: 'center',
  gap: space[8],
  minWidth: 0,
} satisfies CSSProperties

/** Narrow: the disclosure, the at-a-glance budgets and the actions, on one
 * wrapping row. */
const BAR_STYLE = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  columnGap: space[12],
  rowGap: space[6],
  padding: `${space[10]} ${space[16]}`,
} satisfies CSSProperties
const BAR_HEADING_STYLE = { flex: '1 1 auto', minWidth: 0 } satisfies CSSProperties
const BAR_ACTIONS_STYLE = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[8],
  marginLeft: 'auto',
} satisfies CSSProperties

/** A bare button wearing its heading's type — `inherit` across the board,
 * because a button's UA style resets font, tracking and case. */
const TOGGLE_STYLE = {
  ...TITLE_STYLE,
  maxWidth: '100%',
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

const NAME_STYLE = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: color.ink75,
} satisfies CSSProperties

const BUDGET_ROW_STYLE = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[6],
} satisfies CSSProperties

/** No `display` here: the list is folded with the `hidden` attribute. */
const LIST_STYLE = { padding: `${space[12]} ${space[16]}` } satisfies CSSProperties
const ENTRY_STYLE = {
  display: 'flex',
  alignItems: 'center',
  gap: space[6],
  marginBottom: space[6],
} satisfies CSSProperties
const ENTRY_TOKEN_STYLE = { flex: '1 1 auto', minWidth: 0 } satisfies CSSProperties

const EMPTY_STYLE = {
  margin: space[0],
  fontFamily: font.body,
  fontSize: fontSize.xs,
  color: color.wkMuted,
} satisfies CSSProperties

const ACTIONS_STYLE = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  gap: space[8],
  padding: `${space[10]} ${space[16]}`,
  borderTop: `${borderWidth.hairline} solid ${color.ink20}`,
} satisfies CSSProperties
