/**
 * CrewSeats — "Crew & seats" on a Game's page: the crawler card, one row per
 * member's pilot, then the open seats.
 *
 * Pins what each row says (role, who, what they have), how an open seat
 * reads, the seat count's grammar, and the crawler card's stats — including a
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
  { key: 'm', role: 'Mediator', who: 'alxjrvs', unit: 'Runs the table' },
  { key: 'p', role: 'Player', who: 'Sam', unit: 'Ghost · Iron Jaw' },
  { key: 'o', role: 'Open', who: 'Rook', unit: 'Waiting for a player' },
]

function seatTexts(): string[][] {
  return within(screen.getByRole('list', { name: 'Seats' }))
    .getAllByRole('listitem')
    .map((li) => Array.from(li.children).map((c) => c.textContent ?? ''))
}

describe('CrewSeats', () => {
  test('each seat says its role, who holds it and what they have; an open one who waits', () => {
    render(<CrewSeats crawler={CRAWLER} rows={ROWS} claimed={1} total={2} />)
    expect(seatTexts()).toEqual([
      ['Mediator', 'alxjrvs', 'Runs the table'],
      ['Player', 'Sam', 'Ghost · Iron Jaw'],
      ['Open', '—', 'Rook · waiting for a player'],
    ])
    // The count is the label-first chip, `SEATS | 1/2`.
    expect(screen.getByText('Seats').closest('.su-stat-cell')?.textContent).toBe('Seats1/2')
  })

  test('the crawler card carries its name, tech level, SP and bays', () => {
    render(<CrewSeats crawler={CRAWLER} rows={[]} claimed={0} total={1} />)
    expect(screen.getByText('Tenacity')).toBeTruthy()
    expect(screen.getByText('TL')).toBeTruthy()
    expect(screen.getByText('14/20')).toBeTruthy()
    expect(screen.getByText('Bays')).toBeTruthy()
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
