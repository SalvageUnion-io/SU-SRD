/**
 * TableSeats — "The table", the Mediator Dashboard's major panel (board M1;
 * docs/architecture/mediator-dashboard.md Q5): every claimed seat, live, in a
 * `TitledBox` as each of the dashboard's sections is.
 *
 * Each seat is drawn as every crew list draws a crewmate (`CrewRow`, as the
 * player Dashboard's Crew tab does): the pilot's Row with HP and AP as
 * label-first chips (`HP | 8/10`), their mech as a Token (`SP | 6/9`) under
 * it, then "Fine" or ▲ and the first problem. A seat with a problem takes a
 * `--color-status-bad` outline, and the ▲ word always comes with it, so colour
 * is never the only signal.
 *
 * The Row is in select mode (EDL "Modes": ink ring and the "Selected" seal):
 * picking it aims the propose dock at that pilot (the commonest Mediator
 * loop, see the problem, propose the fix). Its accessible name reads the
 * whole line; its View control opens the read-only sheet.
 *
 * The seats are a grid of columns at least `SEAT_MIN` wide, as many as fit:
 * wide enough that a Row keeps its name, its chips and its controls legible,
 * two to the canvas's table and one to a phone. On the canvas a full table
 * scrolls inside the box (the one panel-internal scroll there), so the
 * display below keeps its room; the phone column takes every seat.
 *
 * Presentational: `tableSeats()` builds the seats.
 */

import type { CSSProperties } from 'react'
import { space } from '../../design/tokens'
import { CrewRow } from '../dashboard/CrewRow'
import { buttonVariants, EmptyState, TitledBox } from '../index'
import { AppLink } from '../shared/AppLink'
import type { SeatCard } from './seatCards.model'

/** A seat's narrowest: room for a Row's name, its two chips and its controls. */
const SEAT_MIN = '20rem'

const LIST = {
  listStyle: 'none',
  margin: 0,
  // Room for the attention outline, which sits outside the Row.
  padding: space[4],
  display: 'grid',
  gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${SEAT_MIN}), 1fr))`,
  gap: space[12],
  alignItems: 'start',
} satisfies CSSProperties

/** On the canvas: two rows of seats show, and a third peeks, then it scrolls. */
const LIST_CANVAS = {
  ...LIST,
  maxHeight: '15.5rem',
  overflowY: 'auto',
} satisfies CSSProperties

const SEAT = { minWidth: 0 } satisfies CSSProperties

const VIEW = { textDecoration: 'none' } satisfies CSSProperties

export function TableSeats({
  seats,
  picked,
  onPick,
  stacked = false,
}: {
  seats: readonly SeatCard[]
  /** The pilot row the propose dock is aimed at, if a seat is. */
  picked: string | null
  onPick: (seat: SeatCard) => void
  /** The phone column: every seat, at its own height, no inner scroll. */
  stacked?: boolean
}) {
  return (
    <TitledBox as="section" title="The table" titleAs="h2">
      {seats.length === 0 ? (
        <EmptyState
          variant="quiet"
          body="No one has a seat yet. A player takes one by claiming a pilot in this Game."
        />
      ) : (
        <ul style={stacked ? LIST : LIST_CANVAS} aria-label="Seats">
          {seats.map((seat) => (
            <li key={seat.pilotId} style={SEAT}>
              <CrewRow
                line={seat}
                status={seat.status === 'Fine' ? null : seat.status}
                mode={{
                  kind: 'select',
                  role: 'radio',
                  selected: picked === seat.rowId,
                  onSelect: () => onPick(seat),
                  label: seat.label,
                }}
                controls={
                  <AppLink
                    href={seat.href}
                    aria-label={`View ${seat.name}`}
                    className={buttonVariants({ variant: 'default', size: 'mini' })}
                    style={VIEW}
                  >
                    View
                  </AppLink>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </TitledBox>
  )
}
