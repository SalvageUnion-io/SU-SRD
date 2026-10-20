/**
 * CrewSeats — "Crew & seats" on a Game's own page (board M2;
 * docs/architecture/play.md §16): the crawler as a Compact, then
 * one entry per member's pilot, then the open seats, drawn as every crew list
 * draws them: the pilot's Compact, opening its sheet (a Manage Compact links, ruleset
 * §1.9), with who holds the seat right of the name, the seat's role (PLAYER or
 * OPEN), the pilot's `HP | current/max` (`crew.vitals`) and its assigned mech
 * as a relation chip, `MECH | name`, opening the mech's sheet (C11).
 * The Mediator's seat carries no role chip: the page's band already says who
 * mediates. (Play's Mediator screen shows where they **are**.) A member with
 * no pilot is a plain line. An open seat is an unclaimed pilot. The
 * `SEATS | n/m` chip counts claimed pilots out of all of them; the schema has
 * no seat capacity, so none is invented.
 *
 * There is no Here / Away column: nothing writes presence (see
 * `convex/mediator.ts`), and a permanently false "Here" is worse than none.
 */

import type { CSSProperties } from 'react'
import { Badge, relation, SlabSection, Stat } from '../../components/index'
import { UnitRow } from '../../components/shared/UnitRow'
import { color, font, fontSize, size, space } from '../../design/tokens'
import type { CrawlerReading } from './crawlerReading.model'
import { crawlerVitals } from './crawlerReading.model'
import { HUB_BODY } from './hubStyles.model'
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
  minHeight: size.full,
} satisfies CSSProperties

function stamp(text: string) {
  return (
    <Badge shape="stamp" size="mini">
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
  const { mech, mechHref, href } = row.pilot
  return (
    <UnitRow
      kind="pilot"
      name={row.pilot.name}
      mode={{ kind: 'link', href }}
      note={row.role === 'Mediator' ? undefined : row.role}
      readings={row.hp === null ? undefined : [{ label: 'HP', value: row.hp }]}
      // Who holds the seat: the Compact's first chip.
      labels={row.role === 'Open' ? undefined : <Stat label={row.who} size="compact" />}
      // The mech the pilot is assigned, a relation chip opening its sheet (C11);
      // on foot the lane stays empty (C6).
      relations={
        mech === null
          ? undefined
          : [relation('mech', 'Mech', mech, { href: mechHref ?? undefined })]
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
    <SlabSection
      as="h2"
      bodyStyle={HUB_BODY}
      id="crew-seats-heading"
      title="Crew & seats"
      count={{ label: 'Seats', value: claimed, max: total }}
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
    </SlabSection>
  )
}
