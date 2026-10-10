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

const { ConnectionProvider } = await import('../../../lib/connection/ConnectionProvider')
const { ConnectionContext } = await import('../../../lib/connection/connectionContext')
const { NotConnectedBanner } = await import('../NotConnectedBanner')

describe('NotConnectedBanner', () => {
  test('renders nothing in Solo mode', () => {
    render(
      <ConnectionProvider>
        <NotConnectedBanner />
      </ConnectionProvider>
    )
    expect(screen.queryByText(/Not connected/)).toBeNull()
  })

  test('renders nothing in Solo mode even when the browser reports offline', () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'onLine')
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    try {
      render(
        <ConnectionProvider>
          <NotConnectedBanner />
        </ConnectionProvider>
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
      <ConnectionContext.Provider
        value={{
          mode: 'disconnected',
          canWrite: false,
          showDisconnectedWarning: true,
          settling: false,
        }}
      >
        <NotConnectedBanner />
      </ConnectionContext.Provider>
    )
    const banner = screen.getByRole('alert')
    expect(banner.textContent).toContain('read-only until the connection returns')
    // The warn pill: status-warn edge, ink text — never the failure red (issue 1255).
    const pill = banner.querySelector('li')
    expect(pill?.className).toContain('border-status-warn')
    expect(pill?.className).toContain('text-ink')
  })
})
