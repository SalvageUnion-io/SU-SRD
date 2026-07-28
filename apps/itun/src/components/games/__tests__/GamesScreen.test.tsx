import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'

import { ConnectionProvider } from '../../../lib/connection/ConnectionProvider'
import { isConvexConfigured } from '../../../lib/connection/convexClient'
import { GamesScreen } from '../GamesScreen'

/**
 * Same structural guard as the account screen: every Convex hook in here
 * (`useQuery`, `useMutation`) throws without a provider above it, and a Solo
 * build deliberately has none.
 *
 * This is the failure mode that hides best — it works perfectly for whoever
 * is developing with a configured `.env.local`, and crashes for every user who
 * never signs in.
 */

describe('GamesScreen in a Solo build', () => {
  test('the test build really is Solo', () => {
    expect(isConvexConfigured).toBe(false)
  })

  test('renders without a Convex provider present', () => {
    render(
      <ConnectionProvider>
        <GamesScreen />
      </ConnectionProvider>
    )
    expect(screen.getByText('Games')).toBeTruthy()
  })

  test('explains why shared games are unavailable rather than showing a broken form', () => {
    render(
      <ConnectionProvider>
        <GamesScreen />
      </ConnectionProvider>
    )
    expect(screen.getByText(/saved on this device/i)).toBeTruthy()
    // No create/join affordance should be offered when it cannot possibly work.
    expect(screen.queryByLabelText('New game name')).toBeNull()
    expect(screen.queryByLabelText('Invite code')).toBeNull()
  })
})
