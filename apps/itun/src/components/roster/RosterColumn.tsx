/**
 * The hub's three columns — Pilots, Mechs, Crawlers — and the phone switch
 * between them (design-spec §3.7).
 *
 * `/` shows one container at a time: My Stuff (`Roster`) or a Game
 * (`GameRoster`). Both answer "what have I got, and what can I do with it" of a
 * different container, so they share these columns rather than drawing two
 * vocabularies for one question. What goes INSIDE a column is the caller's: a
 * flat list on My Stuff, yours-then-everyone-else's in a Game.
 *
 * At the mobile endpoint (≤ md) the three columns collapse to one, behind a
 * segmented switch the page owns — so the segment a player picked survives
 * switching between My Stuff and a Game.
 */

import { Button, buttonVariants, cn, EmptyState, Slab } from 'component-lib'
import { Bot, UserRound, Warehouse } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { AppLink } from '../shared/AppLink'

export type SegmentKind = 'pilot' | 'mech' | 'crawler'

const SEGMENTS: ReadonlyArray<{ kind: SegmentKind; label: string }> = [
  { kind: 'pilot', label: 'Pilots' },
  { kind: 'mech', label: 'Mechs' },
  { kind: 'crawler', label: 'Crawlers' },
]

/** The column's create CTA. `onClick` runs before the wizard opens. */
export type ColumnCreate = { href: string; label: string; onClick?: () => void }

/**
 * The selected segment is an INK plate, never rust: rust is the one action
 * colour, and a selected state is ink (as the Dashboard's deck chips and the
 * sheet's Read | Edit draw it).
 */
const SELECTED: CSSProperties = {
  backgroundColor: 'var(--color-ink)',
  borderColor: 'var(--color-ink)',
  color: 'var(--color-paper)',
}

/** Mobile-endpoint segmented Pilot/Mech/Crawler switch (design §3.7). */
export function SegmentSwitch({
  active,
  onChange,
}: {
  active: SegmentKind
  onChange: (kind: SegmentKind) => void
}) {
  return (
    <div className="mt-5 flex gap-2 md:hidden">
      {SEGMENTS.map((seg) => (
        <Button
          key={seg.kind}
          size="compact"
          aria-pressed={active === seg.kind}
          style={active === seg.kind ? SELECTED : undefined}
          onClick={() => onChange(seg.kind)}
          className="min-h-11 flex-1"
        >
          {seg.label}
        </Button>
      ))}
    </div>
  )
}

/** One column on a phone, three from `md` up. */
export function RosterGrid({ children }: { children: ReactNode }) {
  return <div className="mt-5 grid grid-cols-1 gap-8 md:mt-6 md:grid-cols-3">{children}</div>
}

/** A column's rows; `labelledBy` names a sub-list (a Game's YOURS group). */
export function RosterList({ labelledBy, children }: { labelledBy?: string; children: ReactNode }) {
  return (
    <ul aria-labelledby={labelledBy} className="flex flex-col gap-2.5">
      {children}
    </ul>
  )
}

/** Entity-tone glyph shown above a column's empty state (design review U-6). */
const EMPTY_ICON: Record<SegmentKind, ReactNode> = {
  pilot: <UserRound className="size-7 text-sheet-pilot-deep" />,
  mech: <Bot className="size-7 text-sheet-mech-deep" />,
  crawler: <Warehouse className="size-7 text-sheet-crawler-deep" />,
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
    <section aria-labelledby={headingId} className={cn(!active && 'hidden md:block')}>
      {/* The column heading is the ink section stamp (`Slab`), its controls at
          the end of the leader rule. */}
      <Slab
        as="h2"
        id={headingId}
        variant="solid"
        label={title}
        className="mb-3"
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
                  className={cn(
                    buttonVariants({ variant: 'default', size: 'compact' }),
                    'no-underline'
                  )}
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
                className={cn(
                  buttonVariants({ variant: 'primary', size: 'compact' }),
                  'no-underline'
                )}
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
