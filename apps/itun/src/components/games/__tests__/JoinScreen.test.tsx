import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'

import { ConnectionProvider } from '../../../lib/connection/ConnectionProvider'
import { isConvexConfigured } from '../../../lib/connection/convexClient'
import { JoinScreen } from '../JoinScreen'

/**
 * The same structural guard the other Game surfaces carry: every Convex hook
 * throws without a provider above it, and a Solo build deliberately has none.
 *
 * It matters more here than anywhere else. `/join/$code` is the one URL a
 * stranger can be handed, so it is the most likely page in the app to be opened
 * by someone whose build has no account service at all — and a white screen
 * would look like the inviter sent a broken link.
 */

afterEach(cleanup)

describe('JoinScreen in a Solo build', () => {
  test('the test build really is Solo', () => {
    expect(isConvexConfigured).toBe(false)
  })

  test('renders without a Convex provider present', () => {
    render(
      <ConnectionProvider>
        <JoinScreen code="A1B2C3D4" />
      </ConnectionProvider>
    )
    expect(screen.getByText('Join a game')).toBeTruthy()
  })

  test('says the build cannot accept invites rather than showing a dead button', () => {
    render(
      <ConnectionProvider>
        <JoinScreen code="A1B2C3D4" />
      </ConnectionProvider>
    )
    expect(screen.getByText(/no account service configured/i)).toBeTruthy()
    expect(screen.queryByText(/Join this game/i)).toBeNull()
  })
})
