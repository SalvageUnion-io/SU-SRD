/**
 * "Last time at the table" on a Game's page (play.md §16): nothing until the
 * Game has been played; the newest play's span, counts and lines, newest
 * first, with or without a group session; "This session" while one runs; the
 * Mediator's word that an encounter is still running; and a long one folded
 * behind "Show all".
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { formatDateTime } from '../../../lib/formatDate'
import { closeRooms, serve } from '../../../replica/__tests__/fakeRooms'
import type { TableEvent } from '../../../rooms/game/events'
import { LastSession } from '../LastSession'

afterEach(closeRooms)

const T0 = Date.UTC(2026, 10, 20, 19, 0)
let n = 0
function event(minute: number, text: string, more: Partial<TableEvent> = {}): TableEvent {
  return { _id: `e${n++}`, ts: T0 + minute * 60_000, kind: 'action', text, actorId: 'u1', ...more }
}

/** Both of the page's places, as the Game page stands them (r6 C1). */
function Both({ next }: { next?: string | null }) {
  return (
    <>
      <LastSession gameId="g1" place="lead" plans={() => ({ next: next ?? null, last: null })} />
      <LastSession gameId="g1" place="after" />
    </>
  )
}

function renderWith(events: TableEvent[] | null, next?: string | null) {
  if (events !== null) serve('g1', { events: events as never })
  return render(<Both next={next ?? null} />)
}

/** An ended session's raw lines wait under Full log (r6 C1). */
function openFullLog() {
  act(() => {
    fireEvent.click(screen.getByRole('button', { name: 'Full log' }))
  })
}

describe('Last time at the table', () => {
  test('shows nothing before the events arrive, or when nothing has been played', () => {
    const before = renderWith(null)
    expect(before.container.innerHTML).toBe('')
    before.unmount()
    const none = renderWith([event(1, 'Vex joined', { kind: 'join' })])
    expect(none.container.innerHTML).toBe('')
  })

  // MD4-04: play outside a started session left "Rolls: 0", or nothing at all.
  test('play with no session started is still the last time at the table', () => {
    renderWith([
      event(1, 'Roach rolled 14', { kind: 'roll' }),
      event(4, 'Roach took 2 SP', { kind: 'vitals' }),
    ])
    expect(screen.getByRole('heading', { level: 2, name: 'Last time at the table' })).toBeTruthy()
    const start = formatDateTime(T0 + 60_000)
    const end = formatDateTime(T0 + 4 * 60_000)
    expect(screen.getByText(`${start} to ${end}. Rolls: 1. Vitals changes: 1.`)).toBeTruthy()
  })

  test('its Mediator is told an encounter is still running; nobody else is', () => {
    serve('g1', {
      events: [event(1, 'Roach rolled 14', { kind: 'roll' })] as never,
      mediator: { running: { name: 'Toll Gate' } },
    })
    const mediators = render(<Both />)
    expect(
      screen.getByText('An encounter is still running: Toll Gate. Mediate opens it.')
    ).toBeTruthy()
    mediators.unmount()
    closeRooms()
    renderWith([event(1, 'Roach rolled 14', { kind: 'roll' })])
    expect(screen.queryByText(/still running/)).toBeNull()
  })

  test('an encounter running before anything is played is said on its own', () => {
    serve('g1', { events: [] as never, mediator: { running: { name: 'Toll Gate' } } })
    render(<Both />)
    expect(screen.getByRole('heading', { level: 2, name: 'Last time at the table' })).toBeTruthy()
    expect(screen.getByText(/still running: Toll Gate/)).toBeTruthy()
  })

  test('an ended session reads its span, its counts and its lines, newest first', () => {
    renderWith([
      event(0, 'An older session began', { kind: 'session', session: 'start' }),
      event(1, 'Old roll', { kind: 'roll' }),
      event(2, 'An older session ended', { kind: 'session', session: 'end' }),
      event(10, 'Session began', { kind: 'session', session: 'start' }),
      event(11, 'Roach rolled 14', { kind: 'roll' }),
      event(12, 'Roach took 2 SP', { kind: 'vitals' }),
      event(13, 'Vex rolled 3', { kind: 'roll' }),
      event(20, 'Session ended', { kind: 'session', session: 'end' }),
      event(25, 'Vex left', { kind: 'leave' }),
    ])
    expect(screen.getByRole('heading', { level: 2, name: 'Last time at the table' })).toBeTruthy()
    const start = formatDateTime(T0 + 10 * 60_000)
    const end = formatDateTime(T0 + 20 * 60_000)
    expect(screen.getByText(`${start} to ${end}. Rolls: 2. Vitals changes: 1.`)).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Last time at the table' })).toBeNull()
    openFullLog()
    const lines = within(screen.getByRole('list', { name: 'Last time at the table' }))
      .getAllByRole('listitem')
      .map((li) => li.textContent)
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('Vex rolled 3')
    expect(lines[2]).toContain('Roach rolled 14')
    expect(screen.queryByText(/Old roll|Vex left/)).toBeNull()
  })

  test('while one runs it is "This session", since its start', () => {
    renderWith([
      event(0, 'Session began', { kind: 'session', session: 'start' }),
      event(1, 'Roach rolled 14', { kind: 'roll' }),
    ])
    expect(screen.getByRole('heading', { level: 2, name: 'This session' })).toBeTruthy()
    expect(
      screen.getByText(`Started ${formatDateTime(T0)}. Rolls: 1. Vitals changes: 0.`)
    ).toBeTruthy()
  })

  test('a session with nothing in it has no list', () => {
    renderWith([event(0, 'Session began', { kind: 'session', session: 'start' })])
    expect(screen.getByRole('heading', { level: 2, name: 'This session' })).toBeTruthy()
    expect(screen.queryByRole('list')).toBeNull()
  })

  test('a long session shows its newest twelve lines until "Show all"', () => {
    renderWith([
      event(0, 'Session began', { kind: 'session', session: 'start' }),
      ...Array.from({ length: 15 }, (_, i) => event(i + 1, `Roll ${i + 1}`, { kind: 'roll' })),
    ])
    // Still running: the lines are the session, not folded under Full log.
    expect(screen.queryByRole('button', { name: 'Full log' })).toBeNull()
    const list = () =>
      within(screen.getByRole('list', { name: 'Last time at the table' })).getAllByRole('listitem')
    expect(list()).toHaveLength(12)
    expect(list()[0]?.textContent).toContain('Roll 15')
    expect(screen.queryByText(/Roll 3$/)).toBeNull()
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Show all 15' }))
    })
    expect(list()).toHaveLength(15)
    expect(screen.queryByRole('button', { name: /Show all/ })).toBeNull()
  })

  // r6 C1 (LG6-16, MD6-09): ending the session writes what it came to.
  // r7 C10 (LG7-21): accepted damage is "Damage taken", parts "Salvage and Scrap".
  test('an ended session leads with its recap: who is Down, what was salvaged, what is next', () => {
    const vital = (who: string, label: string, from: number | null, to: number) => ({
      kind: 'vitals' as const,
      vital: { who, label, from, to },
    })
    renderWith(
      [
        event(0, 'Session began', { kind: 'session', session: 'start' }),
        event(1, 'Thresher · SP 15 → 9', vital('Thresher (RAZOR)', 'SP', 15, 9)),
        event(2, 'GHOST · HP 10 → 8', vital('GHOST', 'HP', 10, 8)),
        event(3, 'Thresher · SP 9 → 0', vital('Thresher (RAZOR)', 'SP', 9, 0)),
        event(4, 'Ash accepted: Rigging Arm to Spectrum', { kind: 'proposal', answer: 'accepted' }),
        event(5, 'Ana accepted: Pumpkin · HP → 6', { kind: 'proposal', answer: 'accepted' }),
        event(6, 'Pickle moved their Scrap', { kind: 'downtime' }),
        event(5, 'Mediator began Downtime', { kind: 'downtime' }),
        event(9, 'Session ended', { kind: 'session', session: 'end' }),
      ],
      'The Pylon and after'
    )
    const hurt = within(screen.getByRole('list', { name: 'Hurt and Down' }))
      .getAllByRole('listitem')
      .map((li) => li.textContent)
    expect(hurt[0]).toBe('Thresher (RAZOR) · SP 15 → 0Downneeds repair')
    expect(hurt[1]).toBe('GHOST · HP 10 → 8')
    const moved = within(screen.getByRole('list', { name: 'Salvage and Scrap' }))
    expect(moved.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Salvage and ScrapRigging Arm to Spectrum',
      'Salvage and ScrapPickle moved their Scrap',
    ])
    const damage = within(screen.getByRole('list', { name: 'Damage taken' }))
    expect(damage.getByText('Pumpkin · HP → 6')).toBeTruthy()
    expect(screen.queryByText('Changed hands')).toBeNull()
    expect(screen.getByText('A Downtime was held.')).toBeTruthy()
    expect(screen.getByText('Next session: The Pylon and after')).toBeTruthy()
  })

  // r7 C10 (MD7-09): a pending proposal sat further down; it leads the recap now.
  test('what is still open leads the recap', () => {
    serve('g1', {
      events: [
        event(0, 'Session began', { kind: 'session', session: 'start' }),
        event(1, 'Roach rolled 14', { kind: 'roll' }),
        event(9, 'Session ended', { kind: 'session', session: 'end' }),
      ] as never,
      proposals: [
        { _id: 'op-1', targetName: 'Pickle', field: 'currentHP', after: 7, entityId: 'p1' },
      ] as never,
    })
    render(<Both />)
    const open = within(screen.getByRole('list', { name: 'Still open' }))
    expect(open.getByText('Pickle · HP → 7')).toBeTruthy()
  })
})
