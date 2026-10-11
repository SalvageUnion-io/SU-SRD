/**
 * CrewSeats — "Crew & seats" on a Game's own page (board M2;
 * docs/architecture/mediator-dashboard.md Q11): the crawler as a compact card,
 * then one row per member's pilot, then the open seats.
 *
 * A row is the member's role (MEDIATOR or PLAYER), who they are, and what
 * they **have**: "callsign · assigned mech", or "callsign · on foot". (The
 * Mediator Dashboard shows where they **are**.) A Mediator with no pilot reads
 * "Runs the table". An open seat is an unclaimed pilot: "OPEN · callsign ·
 * waiting for a player". "N of M seats" counts claimed pilots out of all of
 * them; the schema has no seat capacity, so none is invented.
 *
 * There is no Here / Away column: nothing writes presence (see
 * `convex/mediator.ts`), and a permanently false "Here" is worse than none.
 */

import { Card, Stat, tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import type { CrawlerReading } from '../mediator/crawlerReading'
import { HubSection } from './HubSection'
import type { SeatRow } from './seatRows'

const { borderWidth, color, font, fontSize, radius, space, tracking, weight } = tokens

const LIST: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  background: color.paper,
  border: `${borderWidth.chrome} solid ${color.ink}`,
  borderRadius: radius.card,
}

const ROW: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '6rem minmax(0, 1fr) minmax(0, 1.3fr)',
  alignItems: 'center',
  gap: space[12],
  minHeight: '48px',
  padding: `${space[8]} ${space[12]}`,
  borderTop: `${borderWidth.hairline} solid ${color.ink15}`,
}

const FIRST_ROW: CSSProperties = { ...ROW, borderTop: `${borderWidth.hairline} solid transparent` }

const ROLE: CSSProperties = {
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.badge,
  letterSpacing: tracking.caps,
  textTransform: 'uppercase',
  color: color.ink75,
}

const WHO: CSSProperties = {
  minWidth: 0,
  overflowWrap: 'anywhere',
  fontFamily: font.body,
  fontSize: fontSize.lede,
  fontWeight: weight.medium,
  color: color.ink,
}

const UNIT: CSSProperties = {
  minWidth: 0,
  overflowWrap: 'anywhere',
  fontFamily: font.body,
  fontSize: fontSize.sm,
  color: color.ink,
}

const CRAWLER_HEAD: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: space[8],
  width: '100%',
}

const CRAWLER_NAME: CSSProperties = {
  fontFamily: font.cond,
  fontWeight: weight.extrabold,
  fontSize: fontSize.title,
  letterSpacing: tracking.capsTight,
  textTransform: 'uppercase',
  color: color.ink,
}

const STATS: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: space[6] }

function CrawlerCard({ crawler }: { crawler: CrawlerReading }) {
  return (
    <Card
      size="medium"
      extent="head"
      headerBgColor={color.crawler}
      headerContent={
        <div style={CRAWLER_HEAD}>
          <span style={CRAWLER_NAME}>{crawler.name}</span>
          <span style={STATS}>
            {crawler.techLevel !== null && (
              <Stat label="TL" value={crawler.techLevel} orientation="horizontal" size="mini" />
            )}
            <Stat
              label="SP"
              value={`${crawler.sp}/${crawler.maxSP}`}
              orientation="horizontal"
              size="mini"
            />
            <Stat label="Bays" value={crawler.bays} orientation="horizontal" size="mini" />
          </span>
        </div>
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
      aside={`${claimed} of ${total} ${total === 1 ? 'seat' : 'seats'}`}
    >
      {crawler !== null && <CrawlerCard crawler={crawler} />}
      <ul style={LIST} aria-label="Seats">
        {rows.map((row, i) => (
          <li key={row.key} style={i === 0 ? FIRST_ROW : ROW}>
            <span style={ROLE}>{row.role}</span>
            <span style={WHO}>{row.role === 'Open' ? '—' : row.who}</span>
            <span style={UNIT}>
              {row.role === 'Open' ? `${row.who} · ${row.unit.toLowerCase()}` : row.unit}
            </span>
          </li>
        ))}
      </ul>
    </HubSection>
  )
}
