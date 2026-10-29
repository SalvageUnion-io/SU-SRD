/**
 * The hub's three columns — Pilots, Mechs, Crawlers — and the phone switch
 * between them (design-spec §3.7).
 *
 * A Game's page (`GameRoster`) and the Starter Set (`StarterSetRoster`) lay
 * their units out in these columns. What goes INSIDE a column is the caller's:
 * yours-then-everyone-else's in a Game, the book's crew in the Starter Set.
 * Shelves (`build/shelves/`) has shelves of its own.
 *
 * At the mobile endpoint (≤ md) the three columns collapse to one, behind a
 * segmented switch the page owns — so the segment a player picked survives
 * switching between Games.
 */

import type { SheetKind } from 'game-domain/entityKinds'
import { Bot, UserRound, Warehouse } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import type { SlabCount } from '../../components/index'
import { Button, EmptyState, Segmented, SegmentedOption, SlabSection } from '../../components/index'
import { color, iconSize, space } from '../../design/tokens'
import { rosterCopy } from '../../messages/build-roster'

export type SegmentKind = SheetKind

const SEGMENTS: ReadonlyArray<{ kind: SegmentKind; label: string }> = [
  { kind: 'pilot', label: rosterCopy('pilots') },
  { kind: 'mech', label: rosterCopy('mechs') },
  { kind: 'crawler', label: rosterCopy('crawlers') },
]

/** The column's create CTA. `onClick` runs before the wizard opens. */
type ColumnCreate = { href: string; label: string; onClick?: () => void }

/** The switch row; it hides from `md` up (`.su-segment-switch`, styles/controls.css). */

/** The switch spans the row: each segment takes its share. */
const FILL = { width: '100%' } satisfies CSSProperties

/** The grid's gutter; its columns and top margin change at `md` (`.su-roster-grid`). */
const GRID = { display: 'grid', gap: space[32] } satisfies CSSProperties

const LIST = { display: 'flex', flexDirection: 'column', gap: space[12] } satisfies CSSProperties

/**
 * Mobile-endpoint segmented Pilot/Mech/Crawler switch. Compact, the Size of
 * the crew's head action beside it ("Copy the crew to…", hard rule R41).
 */
export function SegmentSwitch({
  active,
  onChange,
}: {
  active: SegmentKind
  onChange: (kind: SegmentKind) => void
}) {
  return (
    <div className="su-segment-switch">
      <Segmented label={rosterCopy('show')} size="compact" fill style={FILL}>
        {SEGMENTS.map((seg) => (
          <SegmentedOption
            key={seg.kind}
            pressed={active === seg.kind}
            onClick={() => onChange(seg.kind)}
          >
            {seg.label}
          </SegmentedOption>
        ))}
      </Segmented>
    </div>
  )
}

/** One column on a phone, three from `md` up. */
export function RosterGrid({ children }: { children: ReactNode }) {
  return (
    <div className="su-roster-grid" style={GRID}>
      {children}
    </div>
  )
}

/** A column's rows; `labelledBy` names a sub-list (a Game's YOURS group). */
export function RosterList({ labelledBy, children }: { labelledBy?: string; children: ReactNode }) {
  return (
    <ul aria-labelledby={labelledBy} style={LIST}>
      {children}
    </ul>
  )
}

/** Entity-tone glyph shown above a column's empty state. */
const EMPTY_ICON: Record<SegmentKind, ReactNode> = {
  pilot: <UserRound size={iconSize.full} style={{ color: color.sheetPilotDeep }} />,
  mech: <Bot size={iconSize.full} style={{ color: color.sheetMechDeep }} />,
  crawler: <Warehouse size={iconSize.full} style={{ color: color.sheetCrawlerDeep }} />,
}

type RosterColumnProps = {
  kind: SegmentKind
  title: string
  /** Whether this column is the active mobile segment (always shown ≥ md). */
  active: boolean
  /** The create CTA; omit when the viewer may not create here. */
  create?: ColumnCreate
  emptyMessage: string
  /** Extra head action (e.g. the Mechs column's 'Patterns' link). */
  headExtra?: ReactNode
  /** The Slab's count chip (a Game's Pilots: `SEATS | 1/2`). */
  count?: SlabCount
  /** No rows: the dashed empty state, carrying the create CTA. */
  empty: boolean
  /**
   * The column's own landmark name, for a page with two rosters (`/starter`'s
   * two crews): it names the region instead of the heading, so no two regions
   * share a name and no two headings an id.
   */
  label?: string
  children?: ReactNode
}

export function RosterColumn({
  kind,
  title,
  active,
  create,
  emptyMessage,
  headExtra,
  count,
  empty,
  label,
  children,
}: RosterColumnProps) {
  const headingId = label === undefined ? `${kind}s-heading` : undefined
  return (
    // The column heading is the ink section stamp, its controls at the end of
    // the leader rule (they wrap under the stamp on a narrow column).
    <SlabSection
      as="h2"
      {...(headingId ? { id: headingId } : { 'aria-label': label })}
      title={title}
      {...(count ? { count } : {})}
      className={active ? undefined : 'su-roster-column--inactive'}
      actions={
        headExtra !== undefined || (create !== undefined && !empty) ? (
          <>
            {headExtra}
            {/* One create CTA per column: the header link shows only when the
                  column has rows; the empty state renders its own create CTA. */}
            {create !== undefined && !empty && (
              <Button href={create.href} onClick={create.onClick} size="compact">
                + {create.label}
              </Button>
            )}
          </>
        ) : undefined
      }
    >
      {empty ? (
        <EmptyState
          variant="quiet"
          body={emptyMessage}
          icon={EMPTY_ICON[kind]}
          action={
            create === undefined ? undefined : (
              <Button href={create.href} onClick={create.onClick} variant="primary" size="mini">
                {create.label}
              </Button>
            )
          }
        />
      ) : (
        children
      )}
    </SlabSection>
  )
}
