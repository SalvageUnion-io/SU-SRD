/**
 * The session bar on a Reference page (r2 I1): a signed-in reader whose Game
 * has a session running is told, with the door, and may put the bar away.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SessionBar } from '../SessionBarIsland'
import { dismissSession, liveSessionsOf, sessionKey, sessionsToShow } from '../sessionBar.model'

const CHOIR = { gameId: 'g1', name: 'Rust Choir', startedAt: 100 }

afterEach(() => {
  cleanup()
  window.sessionStorage.clear()
})

describe('the session bar', () => {
  test('a live session is said, with its door to the Game', async () => {
    render(<SessionBar ask={async () => [CHOIR]} />)
    const bar = await screen.findByRole('status')
    expect(bar.textContent).toContain('Session live · Rust Choir')
    const door = screen.getByRole('link', { name: 'Join session' })
    expect(door.getAttribute('href')).toBe('/games/g1')
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
