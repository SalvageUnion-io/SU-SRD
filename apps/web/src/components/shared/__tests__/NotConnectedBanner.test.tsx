import { afterAll, describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { installConvexMocks } from '../../__tests__/convexMock'

/**
 * The regression this guards is the one that would be most embarrassing to
 * ship: telling somebody who never signed in that they are "not connected".
 *
 * The session here is signed out — exactly the state most visitors are in, and
 * exactly the state the banner must stay silent in.
 */

// Module scope, before the imports below — see `convexMock.ts`.
const convexMocks = await installConvexMocks({
  convexReact: { useConvexAuth: () => ({ isAuthenticated: false, isLoading: false }) },
})
afterAll(() => convexMocks.restore())

const { SyncProvider } = await import('../../../replica/SyncProvider')
const { SyncContext } = await import('../../../replica/syncContext')
const { NotConnectedBanner } = await import('../NotConnectedBanner')

describe('NotConnectedBanner', () => {
  test('renders nothing in Solo mode', () => {
    render(
      <SyncProvider>
        <NotConnectedBanner />
      </SyncProvider>
    )
    expect(screen.queryByText(/Not connected/)).toBeNull()
  })

  test('renders nothing in Solo mode even when the browser reports offline', () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'onLine')
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    try {
      render(
        <SyncProvider>
          <NotConnectedBanner />
        </SyncProvider>
      )
      // Offline + signed out is Solo, not Disconnected. A user with no account
      // has nothing to be disconnected FROM.
      expect(screen.queryByText(/Not connected/)).toBeNull()
    } finally {
      // happy-dom defines `onLine` on Navigator.prototype, so there is normally
      // no OWN descriptor to put back, and deleting the own property is the
      // restore. Skipping it left `onLine === false` for every file that ran
      // later in the same process, which then read as Disconnected.
      if (original) Object.defineProperty(navigator, 'onLine', original)
      else Reflect.deleteProperty(navigator, 'onLine')
    }
  })

  test('disconnected, it is the shared Banner at warn: ink text, saying what it costs', () => {
    render(
      <SyncContext.Provider
        value={{
          status: 'offline',
          canWrite: false,
          outdated: false,
        }}
      >
        <NotConnectedBanner />
      </SyncContext.Provider>
    )
    const banner = screen.getByRole('alert')
    expect(banner.textContent).toContain('read-only until the connection returns')
    // The warn pill: status-warn edge, ink text — never the failure red.
    const pill = banner.querySelector('li')
    expect(pill?.style.borderColor).toBe('rgb(192, 122, 47)')
    expect(pill?.style.color).toBe('rgb(40, 32, 25)')
  })
})
