/**
 * Tests for SlotRow — one Major slot and two Minors, placed by the mount
 * (docs/architecture/dashboard-redesign.md D1–D3).
 *
 * The mount comes from the pilot's seat and Downtime; the slots only send
 * Board, Dismount and Eject to the seat, recorded here by `fakeSeat`.
 */

import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { crawlerFixture, mechFixture, pilotFixture } from '../../__tests__/fixtures'
import { SlotRow } from '../SlotRow'
import type { SlotKind } from '../slotLayout'
import { slotsFor } from '../slotLayout'
import type { MountState, SeatHandle } from '../useSeat'
import { boardedSeat, fakeSeat } from './seatFixture'

const mech = mechFixture({ id: 'm1', name: 'Iron Mongrel', chassisRef: 'unknown-chassis' })
const pilot = pilotFixture({ id: 'p1', name: 'Vesh' })
const crawler = crawlerFixture({ id: 'c1', name: 'Mother Hen', techLevel: 'tech-2' })

type Overrides = Partial<{
  mount: MountState
  seat: SeatHandle
  pilot: typeof pilot
  mech: typeof mech
  crawler: typeof crawler | null
  mediator: boolean
  onExpand: (kind: SlotKind, trigger: HTMLButtonElement) => void
}>

function renderRow(o: Overrides = {}) {
  const mount = o.mount ?? 'pilot'
  const seat = o.seat ?? (mount === 'mech' ? boardedSeat(mech.id).handle : fakeSeat().handle)
  return render(
    <SlotRow
      mech={o.mech ?? mech}
      pilot={o.pilot ?? pilot}
      crawler={o.crawler === undefined ? crawler : o.crawler}
      boarded={mount === 'mech'}
      seat={seat}
      mediator={o.mediator ?? false}
      mount={mount}
      onExpand={o.onExpand ?? (() => {})}
    />
  )
}

/** The Minor sections, in order, by their accessible names. */
function minorNames(): string[] {
  return screen.getAllByRole('region').map((el) => el.getAttribute('aria-label') ?? '')
}

describe('slotsFor — who holds the Major (D1)', () => {
  test('on foot, the Pilot is Major; Mech and Crawler are Minors', () => {
    expect(slotsFor('pilot')).toEqual({ major: 'pilot', minors: ['mech', 'crawler'] })
  })

  test('boarded, the Mech is Major; Pilot and Crawler are Minors', () => {
    expect(slotsFor('mech')).toEqual({ major: 'mech', minors: ['pilot', 'crawler'] })
  })

  test('in Downtime, the Crawler is Major; Pilot and Mech are Minors', () => {
    expect(slotsFor('downtime')).toEqual({ major: 'crawler', minors: ['pilot', 'mech'] })
  })
})

describe('SlotRow follows the mount and Downtime', () => {
  test('on foot → the Pilot Major (Vitals, Kit, Abilities, Mount), Mech and Crawler Minors', () => {
    const { container } = renderRow({ mount: 'pilot' })
    expect(container.firstElementChild?.getAttribute('data-major')).toBe('pilot')
    expect(screen.getByText('On Foot')).toBeTruthy()
    for (const bay of ['Vitals', 'Kit', 'Abilities', 'Mount']) {
      expect(screen.getByText(bay)).toBeTruthy()
    }
    expect(minorNames()).toEqual(['Mech · Iron Mongrel', 'Crawler · Mother Hen'])
  })

  test('boarded → the Mech Major (Reactor, Chassis, Egress), Pilot and Crawler Minors', () => {
    const { container } = renderRow({ mount: 'mech' })
    expect(container.firstElementChild?.getAttribute('data-major')).toBe('mech')
    expect(screen.getByText('Boarded')).toBeTruthy()
    for (const bay of ['Reactor', 'Chassis', 'Egress']) {
      expect(screen.getByText(bay)).toBeTruthy()
    }
    expect(minorNames()).toEqual(['Pilot · Vesh', 'Crawler · Mother Hen'])
  })

  test('Downtime → the Crawler Major (Hull, Stores, Bays), Pilot and Mech Minors', () => {
    const { container } = renderRow({ mount: 'downtime' })
    expect(container.firstElementChild?.getAttribute('data-major')).toBe('crawler')
    expect(screen.getByText('Downtime')).toBeTruthy()
    for (const bay of ['Hull', 'Stores', 'Bays', 'Upkeep', 'Upgrade']) {
      expect(screen.getByText(bay)).toBeTruthy()
    }
    expect(minorNames()).toEqual(['Pilot · Vesh', 'Mech · Iron Mongrel'])
  })

  test('the slot row uses no listbox or option roles', () => {
    for (const mount of ['pilot', 'mech', 'downtime'] as const) {
      const { container, unmount } = renderRow({ mount })
      expect(container.querySelector('[role="listbox"], [role="option"]')).toBeNull()
      unmount()
    }
  })
})

describe('the Major sends mount changes to the seat', () => {
  test('Dismount is sent to the seat', () => {
    const { handle, calls } = boardedSeat(mech.id)
    renderRow({ mount: 'mech', seat: handle })
    fireEvent.click(screen.getByText('Dismount'))
    expect(calls).toEqual([{ write: 'dismount', args: [] }])
  })

  test('on foot, Board boards the assigned mech', () => {
    const { handle, calls } = fakeSeat()
    renderRow({ mount: 'pilot', seat: handle })
    fireEvent.click(screen.getByText('▶ Board Iron Mongrel'))
    expect(calls).toEqual([{ write: 'board', args: ['m1'] }])
  })
})

describe('a Minor shows only what needs watching (D3)', () => {
  test('the Pilot Minor shows HP and AP, and an injury in red', () => {
    const hurt = { ...pilot, injuries: [{ severity: 'major' as const, note: 'broken arm' }] }
    renderRow({ mount: 'mech', pilot: hurt })
    const minor = screen.getByRole('region', { name: 'Pilot · Vesh' })
    expect(within(minor).getByRole('img', { name: /HP/ })).toBeTruthy()
    expect(within(minor).getByRole('img', { name: /AP/ })).toBeTruthy()
    expect(within(minor).getByText('Major injury: broken arm')).toBeTruthy()
  })

  test('at rest the Pilot Minor says where the pilot is', () => {
    renderRow({ mount: 'mech' })
    const minor = screen.getByRole('region', { name: 'Pilot · Vesh' })
    expect(within(minor).getByText('In Iron Mongrel · no injuries')).toBeTruthy()
  })

  test('the Mech Minor shows SP, Heat and EP as text, and a damaged system', () => {
    const damaged = {
      ...mech,
      shutdown: true,
      systemConditions: { 'not-a-system': 'damaged' as const },
    }
    renderRow({ mount: 'pilot', mech: damaged })
    const minor = screen.getByRole('region', { name: 'Mech · Iron Mongrel' })
    expect(within(minor).getByRole('img', { name: /SP/ })).toBeTruthy()
    expect(within(minor).getByText(/^Heat \d+\/\d+ · EP \d+\/\d+$/)).toBeTruthy()
    expect(within(minor).getByText('Shut down')).toBeTruthy()
    expect(within(minor).getByText('not-a-system damaged')).toBeTruthy()
  })

  test('the Crawler Minor shows SP, Tech Level and scrap, and a damaged bay', () => {
    const worn = {
      ...crawler,
      scrapPool: { tl1: 12, tl2: 4 },
      crawlerBays: [{ bayRef: 'not-a-bay', condition: 'damaged' as const }],
    }
    renderRow({ mount: 'pilot', crawler: worn })
    const minor = screen.getByRole('region', { name: 'Crawler · Mother Hen' })
    expect(within(minor).getByText('TL2')).toBeTruthy()
    expect(within(minor).getByText('Scrap T1×12 · T2×4')).toBeTruthy()
    expect(within(minor).getByText('not-a-bay damaged')).toBeTruthy()
  })

  test('a pilot with no crawler gets an empty slot, not a crash', () => {
    renderRow({ mount: 'pilot', crawler: null })
    expect(screen.getByText(/No crawler/)).toBeTruthy()
  })

  test('⤢ hands the expand to the Dashboard with the slot it came from', () => {
    const opened: SlotKind[] = []
    renderRow({ mount: 'mech', onExpand: (kind) => opened.push(kind) })
    fireEvent.click(screen.getByRole('button', { name: 'Open the Crawler controls' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open the Pilot controls' }))
    expect(opened).toEqual(['crawler', 'pilot'])
  })
})

describe("the crawler is the Mediator's (D11)", () => {
  test('a player sees the numbers and bays, but no crawler verbs', () => {
    renderRow({ mount: 'downtime', mediator: false })
    expect(screen.getByText('Hull')).toBeTruthy()
    for (const verb of ['Salvage', 'Craft', 'Scrap Mech']) {
      expect(screen.queryByText(verb)).toBeNull()
    }
    expect(screen.getByText(/The Mediator runs the crawler/)).toBeTruthy()
  })

  test('the Mediator gets Salvage, Craft and Scrap Mech', () => {
    renderRow({ mount: 'downtime', mediator: true })
    for (const verb of ['Salvage', 'Craft', 'Scrap Mech']) {
      expect(screen.getByText(verb)).toBeTruthy()
    }
  })
})
