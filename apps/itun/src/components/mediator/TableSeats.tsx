/**
 * TableSeats — "The table", the Mediator Dashboard's major panel (board M1;
 * docs/architecture/mediator-dashboard.md Q5): every claimed seat, live.
 *
 * Each card: a pilot-orange band, the callsign (a link to the read-only
 * sheet), "HP 8/10 · AP 3/5", where they are ("On foot", or "In Spectrum · SP
 * 6/9"), then "Fine" or ▲ and the first problem. A seat with a problem takes a
 * `--color-status-bad` ring drawn inset, as `CrewTab` draws it, and the ▲ word
 * always comes with it, so colour is never the only signal.
 *
 * The body of a card is a button: tapping it picks that pilot as the propose
 * dock's target (the commonest Mediator loop, see the problem, propose the
 * fix). Its accessible name reads the whole line. Seven or more seats scroll
 * sideways with scroll-snap, the one panel-internal scroll on the canvas.
 *
 * Presentational: `tableSeats()` builds the cards.
 */

import { tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import { AppLink } from '../shared/AppLink'
import { EYEBROW, HEAD_ROW, HEADING, MUTED, NUMBERS, PANEL } from './mediatorStyles'
import type { SeatCard } from './seatCards'

const { borderWidth, color, font, fontSize, radius, space, tracking, weight } = tokens

const LIST: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: `0 0 ${space[4]}`,
  flex: 1,
  minHeight: 0,
  display: 'grid',
  gridAutoFlow: 'column',
  gridAutoColumns: 'calc((100% - 5 * 10px) / 6)',
  gap: '10px',
  overflowX: 'auto',
  scrollSnapType: 'x mandatory',
}

/** The stacked fallback: two cards a row, no sideways scroll. */
const LIST_STACKED: CSSProperties = {
  ...LIST,
  gridAutoFlow: 'row',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gridAutoColumns: undefined,
  overflowX: 'visible',
}

// Longhands only, so a card that turns red swaps values rather than mixing a
// shorthand with its longhands across renders.
const CARD: CSSProperties = {
  scrollSnapAlign: 'start',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  background: color.paper,
  borderStyle: 'solid',
  borderWidth: borderWidth.chrome,
  borderTopWidth: '8px',
  borderColor: color.ink,
  borderTopColor: color.pilot,
  borderRadius: radius.card,
  boxShadow: 'none',
  outline: '0 solid transparent',
  outlineOffset: '1px',
}

/** The "look here" ring, inset so the card never changes size. */
const CARD_ATTENTION: CSSProperties = {
  ...CARD,
  borderColor: color.statusBad,
  borderTopColor: color.pilot,
  boxShadow: `inset 0 0 0 1px ${color.statusBad}`,
}

/** The picked target: a heavier ink frame. */
const PICKED: CSSProperties = { outline: `3px solid ${color.ink}` }

const NAME: CSSProperties = {
  display: 'block',
  padding: `${space[8]} ${space[10]} 0`,
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.readout,
  letterSpacing: tracking.capsTight,
  textTransform: 'uppercase',
  color: color.ink,
  textDecoration: 'none',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const BODY_BUTTON: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: space[4],
  minHeight: '48px',
  padding: `${space[4]} ${space[10]} ${space[10]}`,
  border: 0,
  background: 'transparent',
  textAlign: 'left',
  cursor: 'pointer',
  font: 'inherit',
  color: color.ink,
}

const LINE: CSSProperties = {
  ...NUMBERS,
  fontFamily: font.body,
  fontSize: fontSize.caption,
  color: color.ink,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const STRONG: CSSProperties = { fontWeight: weight.bold }

const FINE: CSSProperties = { ...LINE, color: color.ink75 }

const PROBLEM: CSSProperties = { ...LINE, fontWeight: weight.bold }

/** The ▲ is the one mark in the bad hue; the words stay ink. */
const MARK: CSSProperties = { color: color.statusBad }

/** "HP 8/10 · AP 3/5", the numbers bold as on the board. */
function Vitals({ hp, ap }: { hp: string; ap: string }) {
  return (
    <span style={LINE}>
      HP <span style={STRONG}>{hp}</span> · AP <span style={STRONG}>{ap}</span>
    </span>
  )
}

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
  /** The phone column: two cards a row instead of one sideways strip. */
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
        <p style={MUTED}>
          No one has a seat yet. A player takes one by claiming a pilot in this Game.
        </p>
      ) : (
        <ul style={stacked ? LIST_STACKED : LIST} aria-label="Seats">
          {seats.map((seat) => {
            const isPicked = picked === seat.rowId
            const frame = seat.attention ? CARD_ATTENTION : CARD
            return (
              <li key={seat.pilotId} style={isPicked ? { ...frame, ...PICKED } : frame}>
                <AppLink href={seat.href} className="su-focus-ring" style={NAME}>
                  {seat.name}
                </AppLink>
                <button
                  type="button"
                  className="su-focus-ring"
                  style={BODY_BUTTON}
                  aria-label={seat.label}
                  aria-pressed={isPicked}
                  onClick={() => onPick(seat)}
                >
                  <Vitals hp={seat.hp} ap={seat.ap} />
                  <span style={LINE}>{seat.unit}</span>
                  {seat.status === 'Fine' ? (
                    <span style={FINE}>Fine</span>
                  ) : (
                    <span style={PROBLEM}>
                      <span style={MARK} aria-hidden="true">
                        ▲{' '}
                      </span>
                      {seat.status}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
