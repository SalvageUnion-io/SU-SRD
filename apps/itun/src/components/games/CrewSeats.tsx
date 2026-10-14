/**
 * CrewSeats — "Crew & seats" on a Game's own page (board M2;
 * docs/architecture/mediator-dashboard.md Q11): the crawler as a Row, then
 * one entry per member's pilot, then the open seats, drawn as every crew list
 * draws them: the pilot's Row, its seat's role (MEDIATOR, PLAYER or OPEN) and
 * who holds it right of the name, and a foot with what they **have** — their
 * assigned mech as a Token, or "On foot". (The Mediator Dashboard shows where
 * they **are**.) A Mediator with no pilot reads "Runs the table". An open
 * seat is an unclaimed pilot, "Waiting for a player". The `SEATS | n/m` chip counts
 * claimed pilots out of all of them; the schema has no seat capacity, so none
 * is invented.
 *
 * There is no Here / Away column: nothing writes presence (see
 * `convex/mediator.ts`), and a permanently false "Here" is worse than none.
 */

import { Badge, Entity } from 'component-lib'
import { color, font, fontSize, space } from 'component-lib/design/tokens'
import type { CSSProperties } from 'react'
import { unitRowModel } from '../../lib/units/unitModel'
import type { CrawlerReading } from '../mediator/crawlerReading.model'
import { crawlerVitals } from '../mediator/crawlerReading.model'
import { UnitRow } from '../shared/UnitRow'
import { HubSection } from './HubSection'
import type { SeatRow } from './seatRows.model'

const LIST: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: space[12],
}

const ENTRY: CSSProperties = { display: 'flex', flexDirection: 'column', gap: space[4] }

const FOOT: CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: `${space[4]} ${space[8]}`,
  paddingInline: space[2],
}

const TEXT: CSSProperties = {
  color: color.ink,
  fontFamily: font.body,
  fontSize: fontSize.sm,
  overflowWrap: 'anywhere',
}

/** A member with no pilot: no entity to draw, so a plain line. */
const PLAIN: CSSProperties = { ...FOOT, minHeight: '2.75rem', paddingInline: 0 }

function stamp(text: string) {
  return (
    <Badge shape="stamp" size="mini" surface="on-ink">
      {text}
    </Badge>
  )
}

function Seat({ row }: { row: SeatRow }) {
  if (row.pilot === null) {
    return (
      <div style={PLAIN}>
        {stamp(row.role)}
        <span style={TEXT}>{row.who}</span>
        <span style={TEXT}>{row.unit}</span>
      </div>
    )
  }
  return (
    <div style={ENTRY}>
      <UnitRow
        kind="pilot"
        name={row.pilot.name}
        note={row.role}
        labels={row.role === 'Open' ? undefined : stamp(row.who)}
      />
      <div style={FOOT}>
        {row.pilot.mech === null ? (
          <span style={TEXT}>{row.role === 'Open' ? 'Waiting for a player' : 'On foot'}</span>
        ) : (
          <Entity form="token" model={unitRowModel({ kind: 'mech', name: row.pilot.mech })} />
        )}
        {row.role === 'Open' && row.pilot.mech !== null && (
          <span style={TEXT}>Waiting for a player</span>
        )}
      </div>
    </div>
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
