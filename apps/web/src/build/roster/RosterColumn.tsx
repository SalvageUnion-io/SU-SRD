/**
 * The hub's three columns — Pilots, Mechs, Crawlers — and the phone switch
 * between them (design-spec §3.7).
 *
 * A Game's page (`GameRoster`) and the Starter Set (`StarterSetRoster`) lay
 * their units out in these columns. What goes INSIDE a column is the caller's:
 * yours-then-everyone-else's in a Game, the book's crew in the Starter Set.
 * Shelves (`components/shelves/`) has shelves of its own, board S1.
 *
 * At the mobile endpoint (≤ md) the three columns collapse to one, behind a
 * segmented switch the page owns — so the segment a player picked survives
 * switching between Games.
 */

import type { SheetKind } from 'cantina-domain/entityKinds'
import { Bot, UserRound, Warehouse } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { color, space } from '../../design/tokens'
import { buttonVariants, EmptyState, Segmented, SegmentedOption, Slab } from '../index'
import { AppLink } from '../shared/AppLink'

export type SegmentKind = SheetKind

const SEGMENTS: ReadonlyArray<{ kind: SegmentKind; label: string }> = [
  { kind: 'pilot', label: 'Pilots' },
  { kind: 'mech', label: 'Mechs' },
  { kind: 'crawler', label: 'Crawlers' },
]

/** The column's create CTA. `onClick` runs before the wizard opens. */
export type ColumnCreate = { href: string; label: string; onClick?: () => void }

/** The switch row; it hides from `md` up (`.su-segment-switch`, styles/controls.css). */
const SWITCH = { marginTop: space[20] } satisfies CSSProperties

/** The switch spans the row: each segment takes its share. */
const FILL = { width: '100%' } satisfies CSSProperties

/** The grid's gutter; its columns and top margin change at `md` (`.su-roster-grid`). */
const GRID = { display: 'grid', gap: space[32] } satisfies CSSProperties

const LIST = { display: 'flex', flexDirection: 'column', gap: space[10] } satisfies CSSProperties

const NO_UNDERLINE = { textDecorationLine: 'none' } satisfies CSSProperties

/** The Slab row wraps its controls under the stamp on a narrow column. */
const HEAD = { flexWrap: 'wrap', marginBottom: space[12] } satisfies CSSProperties

const ICON = { height: '28px', width: '28px' } satisfies CSSProperties

/** Mobile-endpoint segmented Pilot/Mech/Crawler switch. */
export function SegmentSwitch({
  active,
  onChange,
}: {
  active: SegmentKind
  onChange: (kind: SegmentKind) => void
}) {
  return (
    <div className="su-segment-switch" style={SWITCH}>
      <Segmented label="Show" fill style={FILL}>
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
  pilot: <UserRound style={{ ...ICON, color: color.sheetPilotDeep }} />,
  mech: <Bot style={{ ...ICON, color: color.sheetMechDeep }} />,
  crawler: <Warehouse style={{ ...ICON, color: color.sheetCrawlerDeep }} />,
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
  /** No rows: the dashed empty state, carrying the create CTA. */
  empty: boolean
  children?: ReactNode
}

export function RosterColumn({
  kind,
  title,
  active,
  create,
  emptyMessage,
  headExtra,
  empty,
  children,
}: RosterColumnProps) {
  const headingId = `${kind}s-heading`
  return (
    <section
      aria-labelledby={headingId}
      className={active ? undefined : 'su-roster-column--inactive'}
    >
      {/* The column heading is the ink section stamp (`Slab`), its controls at
          the end of the leader rule. */}
      <Slab
        as="h2"
        id={headingId}
        variant="solid"
        label={title}
        style={HEAD}
        actions={
          headExtra !== undefined || (create !== undefined && !empty) ? (
            <>
              {headExtra}
              {/* One create CTA per column: the header link shows only when the
                  column has rows; the empty state renders its own create CTA. */}
              {create !== undefined && !empty && (
                <AppLink
                  href={create.href}
                  onClick={create.onClick}
                  className={buttonVariants({ variant: 'default', size: 'mini' })}
                  style={NO_UNDERLINE}
                >
                  + {create.label}
                </AppLink>
              )}
            </>
          ) : undefined
        }
      />
      {empty ? (
        <EmptyState
          variant="quiet"
          body={emptyMessage}
          icon={EMPTY_ICON[kind]}
          action={
            create === undefined ? undefined : (
              <AppLink
                href={create.href}
                onClick={create.onClick}
                className={buttonVariants({ variant: 'primary', size: 'mini' })}
                style={NO_UNDERLINE}
              >
                {create.label}
              </AppLink>
            )
          }
        />
      ) : (
        children
      )}
    </section>
  )
}
