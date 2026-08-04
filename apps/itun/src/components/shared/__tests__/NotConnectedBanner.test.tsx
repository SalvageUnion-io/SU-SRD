import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { ConnectionProvider } from '../../../lib/connection/ConnectionProvider'
import { isConvexConfigured } from '../../../lib/connection/convexClient'
import { NotConnectedBanner } from '../NotConnectedBanner'

/**
 * The regression this guards is the one that would be most embarrassing to
 * ship: telling somebody who never signed in that they are "not connected".
 *
 * The test environment has no `VITE_CONVEX_URL`, so it is structurally Solo —
 * which is exactly the state most users are in, and exactly the state the
 * banner must stay silent in.
 */

describe('NotConnectedBanner', () => {
  test('the test build is Solo (no Convex URL compiled in)', () => {
    // Asserted rather than assumed: if this ever flips, the next test would
    // start passing for the wrong reason.
    expect(isConvexConfigured).toBe(false)
  })

  test('renders nothing in Solo mode', () => {
    render(
      <ConnectionProvider>
        <NotConnectedBanner />
      </ConnectionProvider>
    )
    expect(screen.queryByRole('status')).toBeNull()
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
      expect(screen.queryByRole('status')).toBeNull()
    } finally {
      if (original) Object.defineProperty(navigator, 'onLine', original)
    }
  })
})
