import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'

import { ConnectionProvider } from '../../../lib/connection/ConnectionProvider'
import { isConvexConfigured } from '../../../lib/connection/convexClient'
import { AccountScreen } from '../AccountScreen'
import { SignInControl } from '../SignInControl'

/**
 * The failure this guards against is structural rather than cosmetic.
 *
 * `AccountScreen` and `SignInControl` both reach for Convex hooks
 * (`useQuery`, `useMutation`, `useAuthActions`), and every one of those throws
 * without a provider above it. A Solo build deliberately has no provider, so if
 * the build-time branch is ever removed or inverted, this page crashes for the
 * majority of users — the ones who never sign in — while working perfectly for
 * whoever is testing it with a configured `.env.local`.
 *
 * The test environment has no `VITE_CONVEX_URL`, so rendering here without a
 * throw is the assertion.
 */

describe('AccountScreen in a Solo build', () => {
  test('the test build really is Solo', () => {
    // Asserted, not assumed: if this flips, the tests below would start
    // passing for an entirely different reason.
    expect(isConvexConfigured).toBe(false)
  })

  test('renders without a Convex provider present', () => {
    render(
      <ConnectionProvider>
        <AccountScreen />
      </ConnectionProvider>
    )
    expect(screen.getByText('Account')).toBeTruthy()
  })

  test('explains that data is local rather than offering an account', () => {
    render(
      <ConnectionProvider>
        <AccountScreen />
      </ConnectionProvider>
    )
    expect(screen.getByText(/saved on this device/i)).toBeTruthy()
  })

  test('SignInControl renders nothing at all', () => {
    // Not a disabled button: offering an account to somebody whose build
    // cannot have one is worse than silence.
    const { container } = render(
      <ConnectionProvider>
        <SignInControl />
      </ConnectionProvider>
    )
    expect(container.innerHTML).toBe('')
  })
})
