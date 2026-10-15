/**
 * TableSeats — "The table", the Mediator Dashboard's major panel (board M1;
 * docs/architecture/mediator-dashboard.md Q5): every claimed seat, live.
 *
 * Each seat is drawn as every crew list draws a crewmate (`CrewRow`): the
 * pilot's Row with HP and AP as label-first chips (`HP | 8/10`), their mech
 * as a Token (`SP | 6/9`), then "Fine" or ▲ and the first problem. A seat with
 * a problem takes a `--color-status-bad` outline, and the ▲ word always comes
 * with it, so colour is never the only signal.
 *
 * The Row is in select mode (EDL "Modes": ink ring and the "Selected" seal):
 * picking it aims the propose dock at that pilot (the commonest Mediator
 * loop, see the problem, propose the fix). Its accessible name reads the
 * whole line; its View control opens the read-only sheet. A seat is a sixth
 * of the strip or a Row's floor, whichever is wider, and its chips wrap
 * rather than end in an ellipsis, so no value is ever cut. Seats past the
 * strip scroll sideways with scroll-snap, the one panel-internal scroll on
 * the canvas.
 *
 * Presentational: `tableSeats()` builds the seats.
 */

import type { CSSProperties } from 'react'
import { space } from '../../../ui/design/tokens'
import { buttonVariants, EmptyState } from '../../../ui/index'
import { CrewRow } from '../dashboard/CrewRow'
import { AppLink } from '../shared/AppLink'
import { EYEBROW, HEAD_ROW, HEADING, PANEL } from './mediatorStyles.model'
import type { SeatCard } from './seatCards.model'

const LIST = {
  listStyle: 'none',
  margin: 0,
  // Room for the attention outline, which sits outside the Row.
  padding: `${space[4]} ${space[4]} ${space[8]}`,
  flex: 1,
  minHeight: 0,
  display: 'grid',
  gridAutoFlow: 'column',
  // A sixth of the strip, or a Row's floor: no value is cut to fit.
  gridAutoColumns: 'minmax(13rem, calc((100% - 5 * 12px) / 6))',
  gap: '12px',
  alignItems: 'start',
  overflowX: 'auto',
  scrollSnapType: 'x mandatory',
} satisfies CSSProperties

/** The stacked fallback: two seats a row, no sideways scroll. */
const LIST_STACKED = {
  ...LIST,
  gridAutoFlow: 'row',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gridAutoColumns: undefined,
  overflowX: 'visible',
} satisfies CSSProperties

const SEAT = { minWidth: 0, scrollSnapAlign: 'start' } satisfies CSSProperties

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
  /** The phone column: two seats a row instead of one sideways strip. */
  stacked?: boolean
}) {
  return (
    <section aria-labelledby="mediator-table" style={{ ...PANEL, height: '100%' }}>
      <div style={HEAD_ROW}>
        <h2 id="mediator-table" style={HEADING}>
          The table
        </h2>
        <span style={EYEBROW}>Every seat, live</span>
      </div>
      {seats.length === 0 ? (
        <EmptyState
          variant="quiet"
          body="No one has a seat yet. A player takes one by claiming a pilot in this Game."
        />
      ) : (
        <ul style={stacked ? LIST_STACKED : LIST} aria-label="Seats">
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
    </section>
  )
}
