/**
 * CrewSeats — "Crew & seats" on a Game's page: the crawler as a Row, one Row
 * per member's pilot (its mech a chip), then the open seats.
 *
 * Pins what each seat says (role, who, what they have), how an open seat
 * reads, the seat count's grammar, and the crawler Row's chips — including a
 * crawler with no readable tech level, and a Game with no crawler at all.
 */

import { describe, expect, test } from 'bun:test'
import { render, screen, within } from '@testing-library/react'
import { CrewSeats } from '../CrewSeats'
import type { CrawlerReading } from '../crawlerReading.model'
import type { SeatRow } from '../seatRows.model'

const CRAWLER: CrawlerReading = {
  id: 'c1',
  name: 'Tenacity',
  sp: 14,
  maxSP: 20,
  techLevel: 2,
}

const ROWS: SeatRow[] = [
  { key: 'm', role: 'Mediator', who: 'alxjrvs', unit: 'Runs the table', pilot: null, hp: null },
  {
    key: 'mp',
    role: 'Mediator',
    who: 'alxjrvs',
    unit: 'Bonesaw · on foot',
    pilot: { name: 'Bonesaw', href: '/sheet/pilot/bonesaw', mech: null, mechHref: null },
    hp: null,
  },
  {
    key: 'p',
    role: 'Player',
    who: 'Sam',
    unit: 'Ghost · Iron Jaw',
    pilot: {
      name: 'Ghost',
      href: '/sheet/pilot/ghost',
      mech: 'Iron Jaw',
      mechHref: '/sheet/mech/iron-jaw',
    },
    hp: '7/10',
  },
  {
    key: 'o',
    role: 'Open',
    who: 'Rook',
    unit: 'Waiting for a player',
    pilot: { name: 'Rook', href: '/sheet/pilot/rook', mech: null, mechHref: null },
    hp: '10/10',
  },
]

function seats(): HTMLElement[] {
  return within(screen.getByRole('list', { name: 'Seats' })).getAllByRole('listitem')
}

const cellsOf = (el: Element) =>
  [...el.querySelectorAll('.su-entity-row .su-stat-cell')].map((c) => c.textContent)

describe('CrewSeats', () => {
  test('each seat says who holds it, their mech as a chip, and its role; the Mediator only their name', () => {
    render(<CrewSeats crawler={CRAWLER} rows={ROWS} claimed={1} total={2} />)
    const [mediator, mediatorPilot, player, open] = seats()
    // A member with no pilot has no entity to draw: a plain line. The
    // Mediator's is their name alone; the band says who mediates.
    expect(mediator?.textContent).toBe('alxjrvs')
    expect(mediator?.querySelector('.su-entity-row')).toBeNull()
    // The Mediator's pilot carries no MEDIATOR chip, and on foot no mech.
    if (!mediatorPilot) throw new Error('missing seats')
    expect(cellsOf(mediatorPilot)).toEqual(['alxjrvs'])
    // A pilot is a Row: who holds it, its role and HP, then its mech as the
    // relation chip `MECH | name` (C11), never a loose `Stat`.
    if (!player || !open) throw new Error('missing seats')
    expect(within(player).getByText('Ghost')).toBeTruthy()
    expect(cellsOf(player)).toEqual(['Sam', 'Player', 'HP7/10', 'MechIron Jaw'])
    expect(player.querySelector('.su-entity-token')).toBeNull()
    // An open seat is its OPEN chip, with no line of text under it.
    expect(within(open).getByText('Rook')).toBeTruthy()
    expect(cellsOf(open)).toEqual(['Open', 'HP10/10'])
    expect(within(open).queryByText('Waiting for a player')).toBeNull()
    expect(screen.queryByText('On foot')).toBeNull()
    // The count is the label-first chip, `SEATS | 1/2`.
    expect(screen.getByText('Seats').closest('.su-stat-cell')?.textContent).toBe('Seats1/2')
  })

  test('a seat is a Row that opens its pilot’s sheet; its mech a relation chip (C11)', () => {
    render(<CrewSeats crawler={null} rows={ROWS} claimed={1} total={2} />)
    const [, , player] = seats()
    if (!player) throw new Error('missing seats')
    const hrefs = [...player.querySelectorAll('a')].map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual(['/sheet/pilot/ghost'])
    // The mech chip is a relation (a tag in the chip group), never a label
    // beside the name, and the Row opens as one link: no link nests in it.
    const chip = player.querySelector('[data-tag]')
    expect(chip?.textContent).toBe('MechIron Jaw')
  })

  test('the crawler Row carries its name and label-first TL and SP chips, never a bay count', () => {
    const { container } = render(<CrewSeats crawler={CRAWLER} rows={[]} claimed={0} total={1} />)
    expect(screen.getByText('Tenacity')).toBeTruthy()
    expect(cellsOf(container)).toEqual(['TL2', 'SP14/20'])
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
