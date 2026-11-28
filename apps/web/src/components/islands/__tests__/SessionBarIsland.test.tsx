/**
 * The session bar on a Reference page (r2 I1): a signed-in reader whose Game
 * has a session running is told, with the door, and may put the bar away.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SessionBar } from '../SessionBarIsland'
import {
  dismissSession,
  liveSessionsOf,
  sessionDoorHref,
  sessionKey,
  sessionsToShow,
} from '../sessionBar.model'

const CHOIR = { gameId: 'g1', name: 'Rust Choir', startedAt: 100 }

afterEach(() => {
  cleanup()
  window.sessionStorage.clear()
})

describe('the session bar', () => {
  test('a live session is said, and Join session opens the reader’s seat (r3 H3)', async () => {
    render(<SessionBar ask={async () => [{ ...CHOIR, pilotId: 'p1' }]} />)
    const bar = await screen.findByRole('status')
    expect(bar.textContent).toContain('Session live · Rust Choir')
    const door = screen.getByRole('link', { name: 'Join session' })
    expect(door.getAttribute('href')).toBe('/build/pilots/p1/play')
  })

  test('with no one pilot to seat, the door is the Game’s page; a Mediator’s is Mediate', async () => {
    const view = render(<SessionBar ask={async () => [CHOIR]} />)
    await screen.findByRole('status')
    expect(screen.getByRole('link', { name: 'Join session' }).getAttribute('href')).toBe(
      '/games/g1'
    )
    view.unmount()
    render(<SessionBar ask={async () => [{ ...CHOIR, mediator: true, pilotId: 'p1' }]} />)
    await screen.findByRole('status')
    expect(screen.getByRole('link', { name: 'Mediate' }).getAttribute('href')).toBe(
      '/games/g1/mediate'
    )
  })

  test('a tab looked at again asks at once, so an open page hears within seconds (r3 H3)', async () => {
    let asked = 0
    render(
      <SessionBar
        ask={async () => {
          asked += 1
          return asked > 1 ? [CHOIR] : []
        }}
      />
    )
    await waitFor(() => expect(asked).toBe(1))
    expect(screen.queryByRole('status')).toBeNull()
    fireEvent.focus(window)
    expect(await screen.findByRole('status')).toBeTruthy()
  })

  test('no session, no bar', async () => {
    let asked = 0
    render(
      <SessionBar
        ask={async () => {
          asked += 1
          return []
        }}
      />
    )
    await waitFor(() => expect(asked).toBe(1))
    expect(screen.queryByRole('status')).toBeNull()
  })

  test('Dismiss puts it away for the tab, until the Game’s next session', async () => {
    const view = render(<SessionBar ask={async () => [CHOIR]} />)
    await screen.findByRole('status')
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss: Session live · Rust Choir' }))
    expect(screen.queryByRole('status')).toBeNull()
    view.unmount()
    // The next page of the same tab keeps it away; a new session is a new bar.
    render(<SessionBar ask={async () => [CHOIR]} />)
    await waitFor(() => expect(window.sessionStorage.getItem(sessionKey(CHOIR))).toBe('1'))
    expect(screen.queryByRole('status')).toBeNull()
    cleanup()
    render(<SessionBar ask={async () => [{ ...CHOIR, startedAt: 200 }]} />)
    expect(await screen.findByRole('status')).toBeTruthy()
  })
})

describe('the session bar’s model', () => {
  test('reads the Worker’s answer, and nothing from a refusal or a stray shape', () => {
    expect(liveSessionsOf({ ok: true, value: [CHOIR, { gameId: 7 }, null] })).toEqual([CHOIR])
    // Whose door it is: the Mediator's, or the reader's one pilot's seat.
    const seated = { ...CHOIR, mediator: true, pilotId: 'p1' }
    expect(liveSessionsOf({ ok: true, value: [seated] })).toEqual([seated])
    expect(sessionDoorHref(seated)).toBe('/games/g1/mediate')
    expect(sessionDoorHref({ ...CHOIR, pilotId: 'p1' })).toBe('/build/pilots/p1/play')
    expect(sessionDoorHref(CHOIR)).toBe('/games/g1')
    expect(liveSessionsOf({ ok: false, refusal: 'Sign in first' })).toEqual([])
    expect(liveSessionsOf(null)).toEqual([])
  })

  test('a tab with no storage shows every live session', () => {
    expect(sessionsToShow([CHOIR], null)).toEqual([CHOIR])
    dismissSession(CHOIR, null)
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    dismissSession(CHOIR, broken)
    expect(sessionsToShow([CHOIR], broken)).toEqual([CHOIR])
  })
})
