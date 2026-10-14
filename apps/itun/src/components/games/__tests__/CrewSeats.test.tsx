/**
 * CrewSeats — "Crew & seats" on a Game's page: the crawler as a Row, one Row
 * per member's pilot (its mech a Token), then the open seats.
 *
 * Pins what each seat says (role, who, what they have), how an open seat
 * reads, the seat count's grammar, and the crawler Row's chips — including a
 * crawler with no readable tech level, and a Game with no crawler at all.
 */

import { describe, expect, test } from 'bun:test'
import { render, screen, within } from '@testing-library/react'
import type { CrawlerReading } from '../../mediator/crawlerReading.model'
import { CrewSeats } from '../CrewSeats'
import type { SeatRow } from '../seatRows.model'

const CRAWLER: CrawlerReading = {
  id: 'c1',
  name: 'Tenacity',
  sp: 14,
  maxSP: 20,
  techLevel: 2,
  bays: 9,
  baysIntact: 9,
  scrapAtTl: 3,
}

const ROWS: SeatRow[] = [
  { key: 'm', role: 'Mediator', who: 'alxjrvs', unit: 'Runs the table', pilot: null },
  {
    key: 'p',
    role: 'Player',
    who: 'Sam',
    unit: 'Ghost · Iron Jaw',
    pilot: { name: 'Ghost', mech: 'Iron Jaw' },
  },
  {
    key: 'o',
    role: 'Open',
    who: 'Rook',
    unit: 'Waiting for a player',
    pilot: { name: 'Rook', mech: null },
  },
]

function seats(): HTMLElement[] {
  return within(screen.getByRole('list', { name: 'Seats' })).getAllByRole('listitem')
}

const cellsOf = (el: Element) =>
  [...el.querySelectorAll('.su-entity-row .su-stat-cell')].map((c) => c.textContent)

describe('CrewSeats', () => {
  test('each seat says its role, who holds it and what they have; an open one who waits', () => {
    render(<CrewSeats crawler={CRAWLER} rows={ROWS} claimed={1} total={2} />)
    const [mediator, player, open] = seats()
    // A member with no pilot has no entity to draw: a plain line.
    expect(mediator?.textContent).toBe('MediatoralxjrvsRuns the table')
    expect(mediator?.querySelector('.su-entity-row')).toBeNull()
    // A pilot is a Row (its role and who holds it right of the name), its mech a Token.
    if (!player || !open) throw new Error('missing seats')
    expect(within(player).getByText('Ghost')).toBeTruthy()
    expect(within(player).getByText('Player')).toBeTruthy()
    expect(within(player).getByText('Sam')).toBeTruthy()
    expect(player.querySelector('.su-entity-token')?.textContent).toContain('Iron Jaw')
    // An open seat waits for a player.
    expect(within(open).getByText('Rook')).toBeTruthy()
    expect(within(open).getByText('Open')).toBeTruthy()
    expect(within(open).getByText('Waiting for a player')).toBeTruthy()
    // The count is the label-first chip, `SEATS | 1/2`.
    expect(screen.getByText('Seats').closest('.su-stat-cell')?.textContent).toBe('Seats1/2')
  })

  test('the crawler Row carries its name and label-first TL, SP and bays chips', () => {
    const { container } = render(
      <CrewSeats crawler={{ ...CRAWLER, baysIntact: 8 }} rows={[]} claimed={0} total={1} />
    )
    expect(screen.getByText('Tenacity')).toBeTruthy()
    expect(cellsOf(container)).toEqual(['TL2', 'SP14/20', 'Bays8/9'])
    expect(screen.getByText('Seats').closest('.su-stat-cell')?.textContent).toBe('Seats0/1')
  })

  test('a crawler with no readable tech level shows no TL; no crawler, no card', () => {
    const { unmount } = render(
      <CrewSeats crawler={{ ...CRAWLER, techLevel: null }} rows={[]} claimed={0} total={0} />
    )
    expect(screen.getByText('Tenacity')).toBeTruthy()
    expect(screen.queryByText('TL')).toBeNull()
    unmount()

    render(<CrewSeats crawler={null} rows={ROWS} claimed={1} total={2} />)
    expect(screen.queryByText('Tenacity')).toBeNull()
    expect(screen.queryByText('SP')).toBeNull()
  })
})
