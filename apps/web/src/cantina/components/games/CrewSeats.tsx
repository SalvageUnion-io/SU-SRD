/**
 * CrewSeats — "Crew & seats" on a Game's own page (board M2;
 * docs/architecture/mediator-dashboard.md Q11): the crawler as a Row, then
 * one entry per member's pilot, then the open seats, drawn as every crew list
 * draws them: the pilot's Row with, right of the name, who holds the seat, its
 * assigned mech as a `MECH | name` chip, the seat's role (PLAYER or OPEN) and
 * the pilot's `HP | current/max` (`crew.vitals`).
 * The Mediator's seat carries no role chip: the page's band already says who
 * mediates. (The Mediator Dashboard shows where they **are**.) A member with
 * no pilot is a plain line. An open seat is an unclaimed pilot. The
 * `SEATS | n/m` chip counts claimed pilots out of all of them; the schema has
 * no seat capacity, so none is invented.
 *
 * There is no Here / Away column: nothing writes presence (see
 * `convex/mediator.ts`), and a permanently false "Here" is worse than none.
 */

import type { CSSProperties } from 'react'
import { color, font, fontSize, space } from '../../../ui/design/tokens'
import { Badge, Stat } from '../../../ui/index'
import type { CrawlerReading } from '../mediator/crawlerReading.model'
import { crawlerVitals } from '../mediator/crawlerReading.model'
import { UnitRow } from '../shared/UnitRow'
import { HubSection } from './HubSection'
import type { SeatRow } from './seatRows.model'

const LIST = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: space[12],
} satisfies CSSProperties

const TEXT = {
  color: color.ink,
  fontFamily: font.body,
  fontSize: fontSize.sm,
  overflowWrap: 'anywhere',
} satisfies CSSProperties

/** A member with no pilot: no entity to draw, so a plain line. */
const PLAIN = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: `${space[4]} ${space[8]}`,
  minHeight: '2.75rem',
} satisfies CSSProperties

function stamp(text: string) {
  return (
    <Badge shape="stamp" size="mini" surface="on-ink">
      {text}
    </Badge>
  )
}

function Seat({ row }: { row: SeatRow }) {
  if (row.pilot === null) {
    // The Mediator's line is their name alone: the band says who mediates.
    return (
      <div style={PLAIN}>
        {row.role !== 'Mediator' && stamp(row.role)}
        <span style={TEXT}>{row.who}</span>
        {row.role !== 'Mediator' && <span style={TEXT}>{row.unit}</span>}
      </div>
    )
  }
  const { mech } = row.pilot
  return (
    <UnitRow
      kind="pilot"
      name={row.pilot.name}
      note={row.role === 'Mediator' ? undefined : row.role}
      readings={row.hp === null ? undefined : [{ label: 'HP', value: row.hp }]}
      // Who holds the seat, then their mech: the Row's first chips.
      labels={
        row.role === 'Open' && mech === null ? undefined : (
          <>
            {row.role !== 'Open' && (
              <Stat orientation="horizontal" label={row.who} size="compact" />
            )}
            {mech !== null && (
              <Stat orientation="horizontal" label="Mech" value={mech} size="compact" />
            )}
          </>
        )
      }
    />
  )
}

export function CrewSeats({
  crawler,
  rows,
  claimed,
  total,
}: {
  crawler: CrawlerReading | null
  rows: readonly SeatRow[]
  claimed: number
  total: number
}) {
  return (
    <HubSection
      id="crew-seats-heading"
      title="Crew & seats"
      aside={{ label: 'Seats', value: claimed, max: total }}
    >
      {crawler !== null && (
        <UnitRow kind="crawler" name={crawler.name} readings={crawlerVitals(crawler)} />
      )}
      <ul style={LIST} aria-label="Seats">
        {rows.map((row) => (
          <li key={row.key}>
            <Seat row={row} />
          </li>
        ))}
      </ul>
    </HubSection>
  )
}
