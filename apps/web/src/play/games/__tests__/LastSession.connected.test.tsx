/**
 * "Last session" on a Game's page (play.md §16): nothing until the Game has
 * had a group session; the newest one's span, counts and lines, newest first;
 * "This session" while one runs; and a long one folded behind "Show all".
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

function renderWith(events: TableEvent[] | null) {
  if (events !== null) serve('g1', { events: events as never })
  return render(<LastSession gameId="g1" />)
}

describe('Last session', () => {
  test('shows nothing before the events arrive, or when the Game has had no session', () => {
    const before = renderWith(null)
    expect(before.container.innerHTML).toBe('')
    before.unmount()
    const none = renderWith([event(1, 'Roach rolled 14', { kind: 'roll' })])
    expect(none.container.innerHTML).toBe('')
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
      event(25, 'After the session', { kind: 'roll' }),
    ])
    expect(screen.getByRole('heading', { level: 2, name: 'Last session' })).toBeTruthy()
    const start = formatDateTime(T0 + 10 * 60_000)
    const end = formatDateTime(T0 + 20 * 60_000)
    expect(screen.getByText(`${start} to ${end}. Rolls: 2. Vitals changes: 1.`)).toBeTruthy()
    const lines = within(screen.getByRole('list', { name: 'Last session' }))
      .getAllByRole('listitem')
      .map((li) => li.textContent)
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('Vex rolled 3')
    expect(lines[2]).toContain('Roach rolled 14')
    expect(screen.queryByText(/Old roll|After the session/)).toBeNull()
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
    const list = () =>
      within(screen.getByRole('list', { name: 'Last session' })).getAllByRole('listitem')
    expect(list()).toHaveLength(12)
    expect(list()[0]?.textContent).toContain('Roll 15')
    expect(screen.queryByText(/Roll 3$/)).toBeNull()
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Show all 15' }))
    })
    expect(list()).toHaveLength(15)
    expect(screen.queryByRole('button', { name: /Show all/ })).toBeNull()
  })
})
